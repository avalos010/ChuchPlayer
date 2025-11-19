import { useEffect, useRef } from 'react';
import { InteractionManager, Platform } from 'react-native';

interface PerformanceMetrics {
  renderTime: number;
  componentName: string;
  timestamp: number;
}

interface FunctionCallMetrics {
  functionName: string;
  totalExecutionTime: number;
  maxExecutionTime: number;
  timestamp: number;
  callCount: number;
  get averageExecutionTime(): number;
}

const performanceLog: PerformanceMetrics[] = [];
const functionCallLog: Map<string, FunctionCallMetrics> = new Map();
const MAX_LOG_SIZE = 100;
const SLOW_FUNCTION_THRESHOLD = 10; // Log functions taking >10ms

/**
 * Capture stack trace for slow renders
 */
const captureRenderStackTrace = (): string[] => {
  const stack = new Error().stack;
  if (!stack) return [];
  
  const lines = stack.split('\n').slice(3);
  return lines
    .filter(line => {
      return !line.includes('node_modules/react-native') &&
             !line.includes('node_modules/@react-native') &&
             !line.includes('node_modules/react') &&
             !line.includes('usePerformanceMonitor');
    })
    .slice(0, 8)
    .map(line => line.trim());
};

/**
 * Hook to monitor component render performance
 * Logs slow renders (>16ms for 60fps) to help identify performance issues
 */
export const usePerformanceMonitor = (componentName: string, threshold = 16) => {
  const renderStartRef = useRef<number>(0);
  const renderCountRef = useRef<number>(0);

  useEffect(() => {
    renderStartRef.current = performance.now();
    renderCountRef.current += 1;

    return () => {
      const renderTime = performance.now() - renderStartRef.current;
      
      if (renderTime > threshold) {
        const metric: PerformanceMetrics = {
          renderTime,
          componentName,
          timestamp: Date.now(),
        };
        
        performanceLog.push(metric);
        
        // Keep log size manageable
        if (performanceLog.length > MAX_LOG_SIZE) {
          performanceLog.shift();
        }
        
        console.warn(
          `[PERF] Slow render detected: ${componentName} took ${renderTime.toFixed(2)}ms (threshold: ${threshold}ms)`
        );
        
        // Capture and log stack trace for very slow renders (>50ms)
        if (renderTime > 50) {
          const stackTrace = captureRenderStackTrace();
          if (stackTrace.length > 0) {
            console.group(`[PERF] Render stack trace for ${componentName}:`);
            stackTrace.forEach((line, index) => {
              const isOurCode = line.includes('src/');
              const prefix = isOurCode ? '🔴' : '  ';
              console.log(`${prefix} ${index + 1}. ${line}`);
            });
            console.groupEnd();
          }
        }
      }
    };
  });
};

/**
 * Get performance metrics for debugging
 */
export const getPerformanceMetrics = (): PerformanceMetrics[] => {
  return [...performanceLog];
};

/**
 * Clear performance log
 */
export const clearPerformanceMetrics = (): void => {
  performanceLog.length = 0;
  functionCallLog.clear();
};

/**
 * Instrument a function to track its execution time
 * Use this to wrap functions that might be causing performance issues
 */
export const instrumentFunction = <T extends (...args: any[]) => any>(
  fn: T,
  functionName: string
): T => {
  if (!__DEV__) return fn;
  
  return ((...args: any[]) => {
    const start = performance.now();
    try {
      const result = fn(...args);
      const executionTime = performance.now() - start;
      
      if (executionTime > SLOW_FUNCTION_THRESHOLD) {
        const existing = functionCallLog.get(functionName);
        const callCount = (existing?.callCount || 0) + 1;
        const totalTime = (existing?.totalExecutionTime || 0) + executionTime;
        const maxTime = Math.max(existing?.maxExecutionTime || 0, executionTime);
        
        const metrics: FunctionCallMetrics = {
          functionName,
          totalExecutionTime: totalTime,
          maxExecutionTime: maxTime,
          timestamp: Date.now(),
          callCount,
          get averageExecutionTime() {
            return this.callCount > 0 ? this.totalExecutionTime / this.callCount : 0;
          },
        };
        
        functionCallLog.set(functionName, metrics);
        
        // Log if it's particularly slow (>50ms) or called many times
        if (executionTime > 50) {
          console.warn(
            `[PERF] Very slow function: ${functionName} took ${executionTime.toFixed(2)}ms (avg: ${metrics.averageExecutionTime.toFixed(2)}ms, called ${callCount} times)`
          );
        }
      }
      
      return result;
    } catch (error) {
      const executionTime = performance.now() - start;
      console.error(`[PERF] Error in ${functionName} after ${executionTime.toFixed(2)}ms:`, error);
      throw error;
    }
  }) as T;
};

/**
 * Get function call metrics
 */
export const getFunctionMetrics = (): FunctionCallMetrics[] => {
  return Array.from(functionCallLog.values())
    .sort((a, b) => b.averageExecutionTime - a.averageExecutionTime)
    .slice(0, 20); // Top 20 slowest functions by average time
};

/**
 * Start periodic reporting of slow functions
 */
export const startFunctionMetricsReporting = (intervalMs: number = 10000) => {
  if (!__DEV__) return () => {};
  
  const intervalId = setInterval(() => {
    const metrics = getFunctionMetrics();
    if (metrics.length > 0) {
      console.group('[PERF] Top slow functions in last period:');
      metrics.forEach((metric, index) => {
        const avgTime = metric.averageExecutionTime;
        const maxTime = metric.maxExecutionTime;
        const totalTime = metric.totalExecutionTime;
        console.log(
          `🔴 ${index + 1}. ${metric.functionName}: avg ${avgTime.toFixed(2)}ms, max ${maxTime.toFixed(2)}ms, total ${totalTime.toFixed(2)}ms (${metric.callCount} calls)`
        );
      });
      console.groupEnd();
      functionCallLog.clear(); // Clear after reporting
    }
  }, intervalMs);
  
  return () => clearInterval(intervalId);
};

/**
 * Enable React Native's built-in performance monitor
 * Shake device or press Cmd+D (iOS) / Cmd+M (Android) to open dev menu
 * Then select "Show Perf Monitor"
 */
export const enablePerformanceMonitor = (): void => {
  if (__DEV__ && Platform.OS !== 'web') {
    // React Native's performance monitor is available via dev menu
    // This just logs instructions
    console.log(
      '[PERF] To enable performance monitor:\n' +
      '  - Shake device or press Cmd+D (iOS) / Cmd+M (Android)\n' +
      '  - Select "Show Perf Monitor" from dev menu\n' +
      '  - Or use: adb shell input keyevent 82 (Android)'
    );
  }
};

/**
 * Sampling profiler to identify blocking functions
 * Samples the stack periodically to see what's running
 */
class SamplingProfiler {
  private samples: Array<{ stack: string[]; timestamp: number }> = [];
  private isSampling = false;
  private sampleInterval: ReturnType<typeof setInterval> | null = null;
  private readonly MAX_SAMPLES = 50;

  startSampling(duration: number = 2000) {
    if (this.isSampling) return;
    
    this.isSampling = true;
    this.samples = [];
    
      const sampleStack = () => {
      if (!this.isSampling) return;
      
      // Sample the stack directly - the getCurrentStack method will skip internal frames
      const stack = this.getCurrentStack();
      if (stack.length > 0) {
        this.samples.push({
          stack,
          timestamp: performance.now(),
        });
        
        // Keep only recent samples
        if (this.samples.length > this.MAX_SAMPLES) {
          this.samples.shift();
        }
      }
    };
    
    // Sample every 10ms during blocking
    this.sampleInterval = setInterval(sampleStack, 10);
    
    // Stop sampling after duration
    setTimeout(() => {
      this.stopSampling();
    }, duration);
  }

  stopSampling() {
    this.isSampling = false;
    if (this.sampleInterval) {
      clearInterval(this.sampleInterval);
      this.sampleInterval = null;
    }
  }

  getMostCommonStack(): string[] | null {
    if (this.samples.length === 0) return null;
    
    // Count occurrences of each stack frame
    const frameCounts = new Map<string, number>();
    
    this.samples.forEach(sample => {
      sample.stack.forEach(frame => {
        const count = frameCounts.get(frame) || 0;
        frameCounts.set(frame, count + 1);
      });
    });
    
    // Get most common frames (appearing in >30% of samples)
    const threshold = this.samples.length * 0.3;
    const commonFrames = Array.from(frameCounts.entries())
      .filter(([_, count]) => count > threshold)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 8)
      .map(([frame]) => frame);
    
    return commonFrames.length > 0 ? commonFrames : null;
  }

  private getCurrentStack(): string[] {
    const stack = new Error().stack;
    if (!stack) return [];
    
    // Skip more frames to get past the sampling infrastructure
    const lines = stack.split('\n').slice(5); // Skip Error, getCurrentStack, setTimeout callback, sampleStack, setInterval callback
    
    const relevantFrames: string[] = [];
    
    for (const line of lines) {
      // Stop if we hit React Native internals
      if (line.includes('node_modules/react-native') || 
          line.includes('node_modules/@react-native') ||
          line.includes('node_modules/react')) {
        break;
      }
      
      // Only include our source files
      if (line.includes('src/')) {
        // Extract file and function name
        const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/) || 
                     line.match(/at\s+(.+?):(\d+):(\d+)/);
        
        if (match) {
          let func, file, lineNum;
          if (match.length === 5) {
            [, func, file, lineNum] = match;
          } else {
            [, file, lineNum] = match;
            func = 'anonymous';
          }
          
          const fileName = file.split('/').pop() || file;
          const funcName = func || 'anonymous';
          
          // Skip internal monitoring code
          if (!funcName.includes('usePerformanceMonitor') &&
              !funcName.includes('useFrameMonitor') &&
              !funcName.includes('SamplingProfiler') &&
              !fileName.includes('usePerformanceMonitor')) {
            relevantFrames.push(`${funcName} (${fileName}:${lineNum})`);
          }
        } else {
          // Fallback: just include the line if it has src/
          const trimmed = line.trim();
          if (!trimmed.includes('usePerformanceMonitor') &&
              !trimmed.includes('useFrameMonitor')) {
            relevantFrames.push(trimmed);
          }
        }
        
        if (relevantFrames.length >= 5) break;
      }
    }
    
    return relevantFrames;
  }

  clear() {
    this.samples = [];
  }
}

const samplingProfiler = new SamplingProfiler();

/**
 * Monitor frame drops and JS thread blocking with stack trace capture
 * Optimized to reduce overhead - only checks every few frames
 */
export const useFrameMonitor = () => {
  useEffect(() => {
    if (!__DEV__) return;

    let frameCount = 0;
    let lastTime = performance.now();
    let droppedFrames = 0;
    let checkInterval = 0;
    let lastStackTrace: string[] = [];
    let blockingStartTime: number | null = null;

    const checkFrames = () => {
      frameCount++;
      checkInterval++;
      
      // Only check every 5 frames to reduce overhead
      if (checkInterval < 5) {
        requestAnimationFrame(checkFrames);
        return;
      }
      checkInterval = 0;

      const now = performance.now();
      const elapsed = now - lastTime;

      // Expected frame time for 60fps is ~16.67ms
      // If we've been blocked for more than 20ms, we likely dropped frames
      // Only log significant drops (>50ms) to reduce console spam
      if (elapsed > 50) {
        const framesDropped = Math.floor((elapsed - 16.67) / 16.67);
        droppedFrames += framesDropped;
        
        // Start sampling profiler when blocking starts
        if (blockingStartTime === null) {
          blockingStartTime = lastTime;
          samplingProfiler.startSampling(1000); // Sample for 1 second
        }
        
        if (framesDropped > 2) {
          const blockingDuration = now - (blockingStartTime || lastTime);
          
          console.warn(
            `[PERF] Frame drop detected: ${framesDropped} frames dropped, JS thread blocked for ${elapsed.toFixed(2)}ms`
          );
          
          // Get most common stack frames from sampling
          const commonStack = samplingProfiler.getMostCommonStack();
          if (commonStack && commonStack.length > 0) {
            console.group(`[PERF] Most common functions during blocking (${blockingDuration.toFixed(2)}ms):`);
            commonStack.forEach((frame, index) => {
              console.log(`🔴 ${index + 1}. ${frame}`);
            });
            console.groupEnd();
            samplingProfiler.clear();
          }
        }
      } else {
        // Reset blocking state when frames are normal
        if (blockingStartTime !== null) {
          samplingProfiler.stopSampling();
          samplingProfiler.clear();
        }
        blockingStartTime = null;
        lastStackTrace = [];
      }

      lastTime = now;

      if (frameCount % 300 === 0) {
        // Log every 5 seconds (300 frames at 60fps)
        if (droppedFrames > 10) {
          console.warn(`[PERF] Total frames dropped in last 5 seconds: ${droppedFrames}`);
          droppedFrames = 0;
        }
      }

      requestAnimationFrame(checkFrames);
    };

    const rafId = requestAnimationFrame(checkFrames);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);
};

