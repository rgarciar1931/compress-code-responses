<?php

declare(strict_types=1);

namespace VendorName\ModuleName\Service;

use Psr\Log\LoggerInterface;
use VendorName\ModuleName\Api\WarmupServiceInterface;
use VendorName\ModuleName\Model\WarmupQueue;
use VendorName\ModuleName\Lock\WarmupLock;

/**
 * Service class for managing warmup requests and endpoint health checks.
 *
 * This service handles incoming warmup requests, validates the request payload,
 * manages the warmup queue, and coordinates with external services to perform
 * cache warmup operations.
 *
 * The warmup process is triggered by:
 * - External CDN health checks
 * - Scheduled cron jobs for proactive cache warming
 * - Manual API invocations by administrators
 *
 * Concurrency is handled via a distributed lock mechanism implemented in
 * {@see \VendorName\ModuleName\Lock\WarmupLock} to prevent overlapping warmup cycles.
 *
 * @package VendorName\ModuleName\Service
 * @author  Developer Team
 * @see     WarmupLock
 * @see     WarmupQueue
 */
class CacheWarmer
{
  /**
   * Default timeout for warmup requests in seconds.
   *
   * @var int
   */
  private const WARMUP_TIMEOUT = 300;

  /**
   * Maximum number of concurrent warmup requests.
   *
   * @var int
   */
  private const MAX_CONCURRENT_WARMUPS = 10;

  /**
   * Retry configuration for failed warmup requests.
   *
   * @var array{max_attempts: int, delay_ms: int, backoff_factor: float}
   */
  private const RETRY_CONFIG = [
    "max_attempts" => 3,
    "delay_ms" => 1000,
    "backoff_factor" => 2.0,
  ];

  /**
   * @param WarmupServiceInterface $warmupService
   * @param LoggerInterface        $logger
   * @param WarmupQueue            $warmupQueue
   */
  public function __construct(
    private readonly WarmupServiceInterface $warmupService,
    private readonly LoggerInterface $logger,
    private readonly WarmupQueue $warmupQueue
  ) {}

  /**
   * Process a warmup request and return execution results.
   *
   * This method validates the request, coordinates the warmup cycle,
   * and returns a summary of executed operations including success/failure
   * counts and any error messages encountered.
   *
   * @param array{
   *     urls: list<string>,
   *     priority: int,
   *     trigger: string,
   *     ttl: int
   * } $request
   * @return array{
   *     processed: int,
   *     successful: int,
   *     failed: int,
   *     skipped: int,
   *     errors: list<string>
   * }
   */
  public function execute(array $request): array
  {
    $urls = $request["urls"] ?? [];
    $priority = $request["priority"] ?? 0;
    $trigger = $request["trigger"] ?? "unknown";
    $ttl = $request["ttl"] ?? 3600;

    if (empty($urls)) {
      $this->logger->notice("Warmup request with empty URLs", ["trigger" => $trigger]);
      return [
        "processed" => 0,
        "successful" => 0,
        "failed" => 0,
        "skipped" => 0,
        "errors" => ["URL list is empty"],
      ];
    }

    $summary = [
      "processed" => 0,
      "successful" => 0,
      "failed" => 0,
      "skipped" => 0,
      "errors" => [],
    ];

    // Acquire distributed lock before starting warmup cycle
    $lock = $this->acquireLock($request);
    if (!$lock) {
      return $summary + ["errors" => ["Warmup already in progress"]];
    }

    try {
      foreach ($urls as $urlIndex => $url) {
        $summary["processed"]++;
        try {
          if ($this->isUrlValid($url)) {
            $result = $this->warmUrl($url, $priority, $ttl);
            if ($result) {
              $summary["successful"]++;
              continue;
            }
          }
          $summary["skipped"]++;
        } catch (\Throwable $th) {
          $summary["failed"]++;
          $this->logger->error(
            sprintf("Warmup failed for URL #%d: %s", $urlIndex + 1, $th->getMessage()),
            ["exception" => $th]
          );
        }
      }
    } finally {
      $lock->release();
    }

    return $summary;
  }

  /**
   * Warm a single URL and return execution status.
   *
   * @param string $url
   * @param int $priority
   * @param int $ttl
   * @return bool
   */
  private function warmUrl(string $url, int $priority, int $ttl): bool
  {
    try {
      $this->warmupService->prefetch($url, $priority, $ttl);
      return true;
    } catch (\Throwable $e) {
      $this->handleWarmupError($url, $e);
      return false;
    }
  }

  /**
   * Validate a URL for warmup processing.
   *
   * @param string $url
   * @return bool
   */
  private function isUrlValid(string $url): bool
  {
    $parsed = parse_url($url);
    if (!$parsed) {
      return false;
    }
    return isset($parsed["scheme"], $parsed["host"]);
  }

  /**
   * Acquire distributed lock to prevent overlapping warmup cycles.
   *
   * @param array<string, mixed> $request
   * @return WarmupLock|null
   */
  private function acquireLock(array $request): ?WarmupLock
  {
    $lock = new WarmupLock(sprintf("warmup_%s", $request["trigger"]), self::WARMUP_TIMEOUT);

    if (!$lock->acquire()) {
      $this->logger->debug("Failed to acquire warmup lock", [
        "trigger" => $request["trigger"] ?? "unknown",
      ]);
      return null;
    }

    return $lock;
  }

  /**
   * Handle warmup errors with retry logic.
   *
   * @param string $url
   * @param \Throwable $exception
   */
  private function handleWarmupError(string $url, \Throwable $exception): void
  {
    $this->logger->error(sprintf("Warmup error: %s", $exception->getMessage()), ["url" => $url]);

    // Add to queue for retry
    $this->warmupQueue->enqueue(
      ["url" => $url],
      self::RETRY_CONFIG["max_attempts"],
      self::RETRY_CONFIG["delay_ms"]
    );
  }
}
