import { act, renderHook } from '@testing-library/react';
import useTheme, { THEME_KEY } from './useTheme';

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

test('follows the system by default and sets no attribute', () => {
  const { result } = renderHook(() => useTheme());
  expect(result.current.theme).toBe('system');
  expect(document.documentElement.dataset.theme).toBeUndefined();
});

test('cycles system → light → dark → system, remembering each choice', () => {
  const { result } = renderHook(() => useTheme());
  act(() => result.current.cycle());
  expect(result.current.theme).toBe('light');
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(localStorage.getItem(THEME_KEY)).toBe('light');

  act(() => result.current.cycle());
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(localStorage.getItem(THEME_KEY)).toBe('dark');

  act(() => result.current.cycle());
  expect(document.documentElement.dataset.theme).toBeUndefined();
  expect(localStorage.getItem(THEME_KEY)).toBeNull();
});

test('restores a stored choice on mount', () => {
  localStorage.setItem(THEME_KEY, 'dark');
  const { result } = renderHook(() => useTheme());
  expect(result.current.theme).toBe('dark');
  expect(document.documentElement.dataset.theme).toBe('dark');
});

test('ignores a stored value it does not know', () => {
  localStorage.setItem(THEME_KEY, 'sepia');
  const { result } = renderHook(() => useTheme());
  expect(result.current.theme).toBe('system');
});
