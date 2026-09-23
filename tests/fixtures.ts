import { createLink, type NewLinkInput } from '../src/core/links';
import type { Link } from '../src/core/types';

export function link(
  input: Partial<NewLinkInput> & { url: string },
  patch: Partial<Link> = {},
): Link {
  return { ...createLink(input), ...patch };
}
