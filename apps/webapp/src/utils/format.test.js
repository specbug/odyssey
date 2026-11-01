import { failText, fmtInterval, plural } from './format';
import { reach } from '../components/Comb';

const NB = ' ';

test('fmtInterval reads days, months and years', () => {
  expect(fmtInterval(0)).toBe(`<${NB}1${NB}d`);
  expect(fmtInterval(9)).toBe(`9${NB}d`);
  expect(fmtInterval(122)).toBe(`4${NB}mo`);
  expect(fmtInterval(577)).toBe(`1.6${NB}yr`);
});

test('plural counts exactly', () => {
  expect(plural(1, 'card')).toBe(`1${NB}card`);
  expect(plural(12, 'card')).toBe(`12${NB}cards`);
});

test('failText names what failed and why', () => {
  expect(failText('load library', new TypeError('Failed to fetch'))).toBe('Couldn’t load library. Server not responding.');
  expect(failText('save note', new Error('500 Internal Server Error'))).toBe('Couldn’t save note. 500 Internal Server Error.');
});

test('reach maps intervals onto a log scale, now to one year', () => {
  expect(reach(0)).toBe(0);
  expect(reach(365)).toBe(1);
  expect(reach(1000)).toBe(1);
  expect(reach(30)).toBeGreaterThan(reach(7));
});
