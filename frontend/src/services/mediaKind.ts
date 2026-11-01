import type { MediaTrack } from '../types/library'

export function isVideoTrack(track?: MediaTrack) {
  return [track?.fileName, track?.filePath, track?.fileUrl]
    .filter((source): source is string => Boolean(source))
    .some((source) => /\.(mp4|webm|mov)(?:$|[?#])/i.test(source))
}
