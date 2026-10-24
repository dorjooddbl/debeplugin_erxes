export const edureportQueries = {
  // Gateway smoke check: reads no data and checks no permission. It goes
  // away once the real operations (docs/SPEC.md §5) exist.
  edureportHealth: () => "ok",
};
