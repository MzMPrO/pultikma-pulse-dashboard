import { MapView, type MapViewProps } from "./MapView";

/** Static decorative map for marketing sections — a non-interactive MapView. */
export function TashkentMap(props: MapViewProps) {
  return <MapView showPopup={false} radii={[500, 1000]} {...props} />;
}
