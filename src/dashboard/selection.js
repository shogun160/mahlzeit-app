import { state } from '../state.js';

export function toggleSelected(day) {
  state.selected[day] = !state.selected[day];
}
