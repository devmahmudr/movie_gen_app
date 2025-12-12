import { Injectable } from '@nestjs/common';
import CircuitBreaker from 'opossum';
import { RECOMMENDATION_CONFIG } from '../../recommendations/constants/recommendation.config';

interface CircuitBreakerState {
  breaker: CircuitBreaker;
  failureCount: number;
  lastFailureTime: number;
}

interface ExecuteOptions {
  timeout?: number;
}

@Injectable()
export class CircuitBreakerService {
  private breakers: Map<string, CircuitBreakerState> = new Map();

  createBreaker(
    name: string,
    fn: (...args: any[]) => Promise<any>,
    options?: Partial<CircuitBreaker.Options>,
  ): CircuitBreaker {
    const breakerOptions: CircuitBreaker.Options = {
      timeout: options?.timeout || 10000,
      errorThresholdPercentage: 50,
      resetTimeout: RECOMMENDATION_CONFIG.CIRCUIT_BREAKER.RESET_TIMEOUT_MS,
      ...options,
    };

    const breaker = new CircuitBreaker(fn, breakerOptions);

    breaker.on('open', () => {
      console.warn(`[CircuitBreaker] ${name} opened - too many failures`);
    });

    breaker.on('halfOpen', () => {
      console.log(`[CircuitBreaker] ${name} half-open - testing`);
    });

    breaker.on('close', () => {
      console.log(`[CircuitBreaker] ${name} closed - healthy`);
    });

    this.breakers.set(name, {
      breaker,
      failureCount: 0,
      lastFailureTime: 0,
    });

    return breaker;
  }

  getBreaker(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name)?.breaker;
  }

  async execute<T>(
    name: string,
    fn: (...args: any[]) => Promise<T>,
    options: ExecuteOptions = {},
    ...args: any[]
  ): Promise<T> {
    let state = this.breakers.get(name);

    // Pass the custom timeout to the breaker when creating it.
    if (!state) {
      // Only pass timeout if it's defined, otherwise let createBreaker use default
      const breakerOptions = options.timeout !== undefined
        ? { timeout: options.timeout }
        : undefined;
      this.createBreaker(name, fn, breakerOptions);
      state = this.breakers.get(name)!;
    }

    // The opossum 'fire' method itself doesn't take a dynamic timeout.
    // The timeout is set when the breaker is created. By recreating if it
    // doesn't exist, we can manage timeouts per service name.

    try {
      const result = await state.breaker.fire(...args);
      state.failureCount = 0;
      return result;
    } catch (error) {
      state.failureCount++;
      state.lastFailureTime = Date.now();
      throw error;
    }
  }

  isOpen(name: string): boolean {
    const state = this.breakers.get(name);
    if (!state) return false;
    return state.breaker.isOpen;
  }

  isHalfOpen(name: string): boolean {
    const state = this.breakers.get(name);
    if (!state) return false;
    return state.breaker.halfOpen;
  }

  canAttempt(name: string): boolean {
    // Allow attempts if breaker is closed or half-open (testing state)
    const state = this.breakers.get(name);
    if (!state) return true; // No breaker exists, allow attempt
    return !state.breaker.isOpen; // Allow if closed or half-open
  }
}

