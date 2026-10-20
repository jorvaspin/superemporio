import { describe, expect, it } from 'vitest';
import { canTransitionOrder, isValidRut } from './index';

describe('domain rules', () => {
  it('accepts a valid Chilean RUT', () => expect(isValidRut('12.345.678-5')).toBe(true));
  it('does not allow an order to return to payment after confirmation', () => {
    expect(canTransitionOrder('confirmed', 'pending_payment')).toBe(false);
  });
});
