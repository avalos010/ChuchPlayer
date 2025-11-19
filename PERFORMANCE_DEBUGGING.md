# Performance Debugging Guide

This app includes several performance monitoring tools to help identify stutters and performance issues.

## Tools Installed

### 1. Custom Performance Monitor (`usePerformanceMonitor`)
- **Location**: `src/hooks/usePerformanceMonitor.ts`
- **What it does**: 
  - Monitors component render times
  - Detects slow renders (>16ms threshold for 60fps)
  - Tracks frame drops and JS thread blocking
  - Logs warnings to console when issues are detected

### 2. Why Did You Render
- **Package**: `@welldone-software/why-did-you-render`
- **What it does**: 
  - Identifies unnecessary re-renders
  - Tracks hook changes
  - Logs when components re-render with same props

### 3. React Native Performance Monitor
- **Built-in**: React Native's native performance monitor
- **How to enable**:
  1. Shake device or press `Cmd+D` (iOS) / `Cmd+M` (Android)
  2. Select "Show Perf Monitor" from dev menu
  3. Or use: `adb shell input keyevent 82` (Android)

## How to Use

### Viewing Performance Metrics

1. **Check Console Logs**:
   - Look for `[PERF]` prefixed messages
   - Slow renders will show: `[PERF] Slow render detected: ComponentName took Xms`
   - Frame drops will show: `[PERF] Frame drop detected: X frames dropped`

2. **View Metrics Programmatically**:
   ```typescript
   import { getPerformanceMetrics } from './src/hooks/usePerformanceMonitor';
   
   // In your code or console
   const metrics = getPerformanceMetrics();
   console.log('Performance metrics:', metrics);
   ```

3. **Clear Metrics**:
   ```typescript
   import { clearPerformanceMetrics } from './src/hooks/usePerformanceMonitor';
   clearPerformanceMetrics();
   ```

### Common Issues to Look For

1. **Slow Renders**:
   - Look for components taking >16ms to render
   - Check if heavy computations are happening during render
   - Consider using `useMemo` or `useCallback`

2. **Frame Drops**:
   - JS thread blocking for >20ms
   - Usually caused by:
     - Heavy synchronous operations
     - Large array operations
     - Database queries on main thread
     - Excessive console.log statements

3. **Unnecessary Re-renders**:
   - Why Did You Render will log when components re-render unnecessarily
   - Look for components re-rendering with same props
   - Use `React.memo` or `useMemo` to prevent

### Debugging Steps

1. **Enable Performance Monitor**:
   - Shake device → "Show Perf Monitor"
   - Watch FPS and JS thread time

2. **Check Console**:
   - Look for `[PERF]` warnings
   - Identify which components are slow

3. **Add Monitoring to Specific Components**:
   ```typescript
   import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
   
   const MyComponent = () => {
     usePerformanceMonitor('MyComponent', 16); // 16ms threshold
     // ... component code
   };
   ```

4. **Profile with React DevTools** (if available):
   - Install React DevTools browser extension
   - Connect to your app
   - Use Profiler tab to record and analyze

## Performance Tips

1. **Reduce Console Logs**: Remove or disable console.log in production
2. **Use Memoization**: `useMemo` for expensive computations, `useCallback` for functions
3. **Lazy Load**: Only load data when needed
4. **Batch Updates**: Group state updates together
5. **Optimize Lists**: Use `FlashList` or `FlatList` with proper `keyExtractor`
6. **Image Optimization**: Use `expo-image` with caching (already implemented)

## Example Output

```
[PERF] Slow render detected: PlayerScreen took 23.45ms (threshold: 16ms)
[PERF] Frame drop detected: 2 frames dropped, JS thread blocked for 35.67ms
[PERF] Total frames dropped in last second: 5
```

## Disabling Performance Monitoring

To disable in production, the hooks check `__DEV__` flag automatically. They won't run in production builds.

