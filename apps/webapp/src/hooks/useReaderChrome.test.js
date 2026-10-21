import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import useReaderChrome from './useReaderChrome';

function Reader({ documentId = 1, ready = true }) {
  const { visible, readerProps, chromeProps, onScroll, onNavigate } = useReaderChrome(documentId, ready);
  return (
    <div data-testid="reader" {...readerProps}>
      <div data-testid="controls" data-visible={visible} {...chromeProps}>
        <button>Library</button>
        <button onClick={onNavigate}>Next page</button>
      </div>
      <div data-testid="pages" onScroll={(event) => onScroll(event.currentTarget)} />
    </div>
  );
}

function scrollTo(y) {
  fireEvent.scroll(screen.getByTestId('pages'), {
    target: { scrollTop: y },
  });
}

function pointer(target, type, properties) {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, properties);
  fireEvent(target, event);
}

function expectVisible(visible) {
  expect(screen.getByTestId('controls')).toHaveAttribute('data-visible', String(visible));
}

beforeEach(() => {
  jest.useFakeTimers();
  // jsdom has no layout, so supply a scrollable document's dimensions.
  jest.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(2000);
  jest.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('fades after 2.6 seconds once the document is ready', () => {
  const { rerender } = render(<Reader ready={false} />);
  act(() => jest.advanceTimersByTime(5000));
  expectVisible(true);
  rerender(<Reader />);
  act(() => jest.advanceTimersByTime(2599));
  expectVisible(true);
  act(() => jest.advanceTimersByTime(1));
  expectVisible(false);
});

test('hides on downward scroll and reveals on upward scroll, ignoring small reversals', () => {
  render(<Reader />);
  scrollTo(100);
  expectVisible(false);
  scrollTo(97);
  expectVisible(false);
  scrollTo(90);
  expectVisible(false);
  scrollTo(85);
  expectVisible(true);
  scrollTo(88);
  expectVisible(true);
  scrollTo(100);
  expectVisible(false);
  scrollTo(0);
  expectVisible(true);
});

test('ignores horizontal scroll and bottom overscroll bounce', () => {
  render(<Reader />);
  scrollTo(1400);
  expectVisible(false);
  scrollTo(1450);
  scrollTo(1400);
  fireEvent.scroll(screen.getByTestId('pages'), { target: { scrollLeft: 50 } });
  expectVisible(false);
});

test('recognizes a real reversal despite noisy trackpad deltas, over repeated cycles', () => {
  render(<Reader />);
  for (let cycle = 0; cycle < 20; cycle += 1) {
    scrollTo(200);
    expectVisible(false);
    scrollTo(194);
    scrollTo(196);
    scrollTo(190);
    expectVisible(false);
    scrollTo(192);
    scrollTo(186);
    expectVisible(true);
    scrollTo(191);
    scrollTo(188);
    expectVisible(true);
    act(() => jest.advanceTimersByTime(2600));
    expectVisible(false);
  }
});

test('page navigation stays visible while settling, but real scrolling takes over immediately', () => {
  render(<Reader />);
  fireEvent.click(screen.getByText('Next page'));
  scrollTo(500);
  scrollTo(1000);
  expectVisible(true);
  fireEvent.wheel(screen.getByTestId('pages'), { deltaY: 50 });
  scrollTo(1050);
  expectVisible(false);
  scrollTo(1000);
  expectVisible(true);
});

test('navigation protection expires instead of disabling scroll hiding permanently', () => {
  render(<Reader />);
  fireEvent.click(screen.getByText('Next page'));
  scrollTo(500);
  act(() => jest.advanceTimersByTime(600));
  scrollTo(550);
  expectVisible(false);
});

test('a mouse click does not pin controls after leaving the toolbar', () => {
  render(<Reader />);
  const button = screen.getByText('Next page');
  jest.spyOn(button, 'matches').mockReturnValue(false);
  pointer(screen.getByTestId('controls'), 'pointerover', { pointerType: 'mouse' });
  pointer(button, 'pointerdown', { pointerType: 'mouse', clientY: 30 });
  act(() => button.focus());
  fireEvent.click(button);
  pointer(screen.getByTestId('controls'), 'pointerout', { pointerType: 'mouse' });
  act(() => jest.advanceTimersByTime(2600));
  expectVisible(false);
});

test('only pointer activity near the top reveals hidden controls', () => {
  render(<Reader />);
  act(() => jest.advanceTimersByTime(2600));
  pointer(screen.getByTestId('reader'), 'pointermove', { clientY: 300 });
  expectVisible(false);
  pointer(screen.getByTestId('reader'), 'pointermove', { clientY: 32 });
  expectVisible(true);
  act(() => jest.advanceTimersByTime(2600));
  pointer(screen.getByTestId('reader'), 'pointerdown', { clientY: 24, pointerType: 'touch' });
  expectVisible(true);
});

test('holds controls visible while hovered, then restarts idle hiding on leave', () => {
  render(<Reader />);
  pointer(screen.getByTestId('controls'), 'pointerover', { pointerType: 'mouse' });
  act(() => jest.advanceTimersByTime(5000));
  scrollTo(200);
  expectVisible(true);
  pointer(screen.getByTestId('controls'), 'pointerout', { pointerType: 'mouse' });
  act(() => jest.advanceTimersByTime(2600));
  expectVisible(false);
});

test('touch pointer entry does not leave controls permanently pinned', () => {
  render(<Reader />);
  pointer(screen.getByTestId('controls'), 'pointerover', { pointerType: 'touch' });
  act(() => jest.advanceTimersByTime(2600));
  expectVisible(false);
});

test('keyboard focus reveals controls and keeps them visible through navigation', () => {
  render(<Reader />);
  act(() => jest.advanceTimersByTime(2600));
  expectVisible(false);
  act(() => screen.getByText('Library').focus());
  expectVisible(true);
  act(() => screen.getByText('Next page').focus());
  scrollTo(300);
  act(() => jest.advanceTimersByTime(5000));
  expectVisible(true);
  act(() => screen.getByText('Next page').blur());
  act(() => jest.advanceTimersByTime(2600));
  expectVisible(false);
});

test('new documents reveal controls and unmount cancels pending timers', () => {
  const { rerender, unmount } = render(<Reader />);
  act(() => jest.advanceTimersByTime(2600));
  expectVisible(false);
  rerender(<Reader documentId={2} />);
  expectVisible(true);
  unmount();
  expect(jest.getTimerCount()).toBe(0);
});
