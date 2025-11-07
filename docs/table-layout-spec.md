# Task Tracker Table Layout Specification

## 1. Overview
- Rebuild the task table as a responsive grid that feels identical at all viewport widths; the only change as the viewport shrinks is the addition of horizontal scrolling.
- All structural styling (padding, borders, backgrounds) must be fixed and deterministic so column headers and body cells stay visually aligned.
- Selection checkbox, primary content column, and each metadata/action column all participate in the same grid definition.

## 2. Grid Structure
- Grid template: `[selection] [item] [metadata…]`, created via CSS grid on both header and row containers so columns stay aligned.
- Column widths:
  - Selection column fixed at `40px`.
  - Item column user resizable with minimum `320px` (desktop) and never less than `280px`.
  - Metadata columns user resizable with per-column minima (see `COLUMN_MIN_WIDTHS` constant).
- Column resizing is performed by dragging the divider that sits between adjacent columns.
- Column order is user reconfigurable; users drag the tactile handle centered above each column to reorder.

## 3. Header Layout
- Each header cell is a `relative` container with:
  1. A drag handle button centered at the top edge (`GripVertical` icon).
  2. A label row containing the column title, sort affordance, and optional filter control.
  3. A vertical divider element on the trailing edge that doubles as the resize handle.
- Background colour: `bg-gray-100` (or equivalent theme token) for every header cell, including the actions column, regardless of viewport width.
- Padding: `px-4 py-3` on all header cells (including the selection column) to keep spacing uniform.
- Divider styling: 1px neutral border stretching full height of the header cell; divider is visible even when hovering the resize handle.
- Resizing: divider element captures `mousedown` and forwards to `handleColumnResizeMouseDown`.

## 4. Body Rows
- Rows mirror the header grid template; there must be no nested flex items that offset the column alignment.
- Cell padding: `px-4 py-3` for every cell.
- Column dividers:
  - Each cell renders a trailing divider identical to the header to maintain a continuous grid of separators.
  - The divider is visually consistent across all rows; on the final visible column the divider is omitted.
- Backgrounds:
  - Default note rows: `bg-white`.
  - Selected rows: `bg-blue-50`.
  - Urgent rows: `bg-red-50`.
  - Done rows: no automatic background change (existing status styling still applies).
  - Comment rows: `bg-gray-50` while inheriting the same padding and divider treatment.
- Actions column body cells use the same background rules as other cells; icon buttons inherit padding from the cell rather than adding custom offsets.

## 5. Responsive Behaviour
- Table container lives inside a `overflow-x-auto` wrapper; min-width is the sum of all column minimums so horizontal scroll appears only when the viewport is narrower.
- Vertical layout never collapses or stacks columns; column visibility toggles are the only way to remove columns.
- Drag and resize affordances remain usable on touch-sized screens (minimum target size 32px square).

## 6. Interaction Rules
- Reordering a column updates `columnOrder` and re-renders both header and body grid templates.
- Resizing updates `columnWidths` (or `itemColumnWidth` for the primary column) and the memoized grid template.
- Selection column never moves or resizes.
- “Item” column drag handle is visible but disabled to communicate immovability.
- Column filter dropdowns remain inline in the header label row, occupying remaining horizontal space without changing padding.

## 7. Implementation Notes
- Shared utility classes for cell padding and divider styles should be extracted to avoid duplication (e.g., `cell-base`, `cell-divider` tailwind compositions).
- Use fragments or helper render functions (`renderColumnHeader`, `renderColumnCell`) to keep the main JSX legible post-refactor.
- Ensure height of dividers spans the full cell by positioning them absolutely within the cell container (`absolute top-0 right-0 h-full`).
- Maintain existing data interactions (inline status/type toggles, project tag editing, urgent sorting) while reworking presentation markup.
- After refactor, re-run `npm run build` to confirm there are no structural regressions.
