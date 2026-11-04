import { parseYouTubeVideoId, toYouTubeEmbedUrl, toYouTubeWatchUrl } from 'jg-utilities';

import { WebsiteUiConfigurationException } from '../exceptions.js';

// normalized single-video configuration shared by the Astro player surfaces
export interface IYouTubeVideo {
  videoId: string;
  title: string;
  watchUrl: string;
  embedUrl: string;
}

/**
 * Validates authored configuration and constructs fixed-origin single-video URLs.
 * @param videoUrl The authored YouTube URL.
 * @param title The accessible title, normalized to a useful fallback when blank.
 * @param autoPlay Whether the consumer explicitly requests playback on loading.
 * @returns The canonical player configuration without authored player parameters.
 * @throws
 * - INVALID_YOUTUBE_VIDEO_URL: The YouTube video URL is not supported.
 */
export const resolveYouTubeVideo = (
  videoUrl: unknown,
  title: unknown,
  autoPlay = false,
): IYouTubeVideo => {
  const videoId = parseYouTubeVideoId(videoUrl);
  if (videoId === null) throw new WebsiteUiConfigurationException('INVALID_YOUTUBE_VIDEO_URL');

  const embedUrl = toYouTubeEmbedUrl(videoId);
  return {
    videoId,
    title: typeof title === 'string' && title.trim() ? title.trim() : 'YouTube video',
    watchUrl: toYouTubeWatchUrl(videoId),
    embedUrl: autoPlay === true ? `${embedUrl}?autoplay=1` : embedUrl,
  };
};
