import { ARROW_PATHS, type ArrowKind } from "./arrows";
import "./dir-arrow.css";

/** Decorative, direction-aware arrow; mirroring follows the element's direction. */
export default function DirArrow({ kind }: { kind: ArrowKind }) {
  return (
    <svg className="of-arrow" data-arrow={kind} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d={ARROW_PATHS[kind]} />
    </svg>
  );
}
