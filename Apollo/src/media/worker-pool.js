/**
 * @module media/worker-pool
 * @description Manages a pool of mediasoup workers, one per CPU core,
 * with round-robin router allocation for load distribution.
 */

const mediasoup = require("mediasoup");
const config = require("../config");
const os = require("os");

/**
 * Manages a pool of mediasoup Workers (one per CPU core).
 * Round-robins new Routers across workers for load distribution.
 */
class WorkerPool {
  /** Creates an empty worker pool. Call {@link WorkerPool#init} to spawn workers. */
  constructor() {
    /** @type {mediasoup.types.Worker[]} */
    this.workers = [];
    this.nextWorkerIdx = 0;
  }

  /**
   * Spawns one mediasoup Worker per CPU core and registers crash handlers.
   * @async
   * @returns {Promise<void>}
   */
  async init() {
    const numWorkers = Math.max(1, os.cpus().length);
    console.log(`[Apollo] Spawning ${numWorkers} mediasoup worker(s)…`);

    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker({
        rtcMinPort: config.worker.rtcMinPort,
        rtcMaxPort: config.worker.rtcMaxPort,
        logLevel: config.worker.logLevel,
        logTags: config.worker.logTags,
      });

      worker.on("died", () => {
        console.error(`[Apollo] mediasoup worker ${worker.pid} died — exiting`);
        process.exit(1);
      });

      this.workers.push(worker);
      console.log(`[Apollo] Worker ${worker.pid} ready`);
    }
  }

  /**
   * Returns the next worker using round-robin selection.
   * @returns {mediasoup.types.Worker} The selected worker.
   */
  getNextWorker() {
    const worker = this.workers[this.nextWorkerIdx];
    this.nextWorkerIdx = (this.nextWorkerIdx + 1) % this.workers.length;
    return worker;
  }

  /**
   * Creates a mediasoup Router on the next available worker.
   * @async
   * @returns {Promise<mediasoup.types.Router>} The newly created router.
   */
  async createRouter() {
    const worker = this.getNextWorker();
    return worker.createRouter({ mediaCodecs: config.router.mediaCodecs });
  }

  /**
   * Closes all workers and empties the pool.
   * @async
   * @returns {Promise<void>}
   */
  async close() {
    for (const w of this.workers) {
      w.close();
    }
    this.workers = [];
  }
}

module.exports = WorkerPool;
