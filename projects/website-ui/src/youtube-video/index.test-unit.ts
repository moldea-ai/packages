// @vitest-environment node
import { expectToThrowCode } from 'jg-exception/testing';
import { expect, test } from 'vitest';

import { resolveYouTubeVideo } from './index.js';

test.each([undefined, 'javascript:alert(1)', 'https://youtube.com.example/watch?v=M7lc1UVf-VE'])(
  'resolveYouTubeVideo(%s) rejects unsupported configuration',
  (videoUrl) => {
    expectToThrowCode(
      () => resolveYouTubeVideo(videoUrl, 'Tutorial'),
      'INVALID_YOUTUBE_VIDEO_URL',
      'The YouTube video URL is not supported.',
    );
  },
);

test('constructs fixed-origin URLs without authored player settings', () => {
  expect(
    resolveYouTubeVideo(
      'https://www.youtube.com/watch?v=M7lc1UVf-VE&autoplay=1&list=playlist&t=30#fragment',
      '  Tutorial  ',
    ),
  ).toStrictEqual({
    videoId: 'M7lc1UVf-VE',
    title: 'Tutorial',
    watchUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
    embedUrl: 'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE',
  });
});

test('normalizes a blank title to the accessible fallback', { tags: ['full'] }, () => {
  expect(resolveYouTubeVideo('https://youtu.be/M7lc1UVf-VE', '  ').title).toBe('YouTube video');
});

test.each([false, true])(
  'requests autoplay only when explicitly enabled (%s)',
  { tags: ['full'] },
  (autoPlay) => {
    expect(resolveYouTubeVideo('https://youtu.be/M7lc1UVf-VE', 'Tutorial', autoPlay).embedUrl).toBe(
      autoPlay
        ? 'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?autoplay=1'
        : 'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE',
    );
  },
);
