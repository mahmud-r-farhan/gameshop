import { describe, expect, it } from 'vitest';
import {
  buildPagination,
  MAX_LIMIT,
  normalizeLimit,
  normalizePage,
  offsetFor,
  toPositiveInt,
} from '../../../src/utils/pagination.js';

describe('toPositiveInt', () => {
  it('parses numeric strings', () => {
    expect(toPositiveInt('7', 1)).toBe(7);
    expect(toPositiveInt(7, 1)).toBe(7);
  });

  it('falls back for values that previously produced NaN', () => {
    // Regression: `?page=abc` -> parseInt -> NaN -> Prisma `skip: NaN` -> HTTP 500.
    expect(toPositiveInt('abc', 3)).toBe(3);
    expect(toPositiveInt('', 3)).toBe(3);
    expect(toPositiveInt(undefined, 3)).toBe(3);
    expect(toPositiveInt(null, 3)).toBe(3);
  });

  it('rejects zero and negative values', () => {
    expect(toPositiveInt('0', 1)).toBe(1);
    expect(toPositiveInt('-5', 2)).toBe(2);
  });

  it('truncates fractional input', () => {
    expect(toPositiveInt('2.9', 1)).toBe(2);
  });
});

describe('normalizePage / normalizeLimit', () => {
  it('applies defaults', () => {
    expect(normalizePage(undefined)).toBe(1);
    expect(normalizeLimit(undefined)).toBe(20);
    expect(normalizeLimit(undefined, 10)).toBe(10);
  });

  // Regression: `?limit=100000` let a client ask for the entire table.
  it('caps the limit', () => {
    expect(normalizeLimit('100000')).toBe(MAX_LIMIT);
    expect(normalizeLimit(MAX_LIMIT)).toBe(MAX_LIMIT);
  });
});

describe('offsetFor', () => {
  it('computes the Prisma skip offset', () => {
    expect(offsetFor(1, 20)).toBe(0);
    expect(offsetFor(3, 20)).toBe(40);
  });

  it('is never negative', () => {
    expect(offsetFor(0, 20)).toBe(0);
    expect(offsetFor(-3, 20)).toBe(0);
  });
});

describe('buildPagination', () => {
  it('reports page counts', () => {
    expect(buildPagination(95, 1, 20)).toEqual({
      currentPage: 1,
      totalPages: 5,
      totalItems: 95,
      itemsPerPage: 20,
      hasNextPage: true,
      hasPreviousPage: false,
    });
  });

  // Regression: `Math.ceil(total / limit)` divided by zero when limit was 0,
  // producing `totalPages: Infinity` in the JSON response.
  it('never divides by zero', () => {
    const pagination = buildPagination(10, 1, 0);
    expect(pagination.totalPages).toBe(10);
    expect(Number.isFinite(pagination.totalPages)).toBe(true);
  });

  it('reports at least one page for an empty result set', () => {
    const pagination = buildPagination(0, 1, 20);
    expect(pagination.totalPages).toBe(1);
    expect(pagination.totalItems).toBe(0);
    expect(pagination.hasNextPage).toBe(false);
  });

  it('flags the last page correctly', () => {
    const pagination = buildPagination(40, 2, 20);
    expect(pagination.hasNextPage).toBe(false);
    expect(pagination.hasPreviousPage).toBe(true);
  });

  it('clamps a nonsensical total', () => {
    expect(buildPagination(-5, 1, 20).totalItems).toBe(0);
  });
});
