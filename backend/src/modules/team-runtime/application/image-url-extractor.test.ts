import { dedupeHttpsImageUrls, extractImageUrlsFromText } from './image-url-extractor.js';

describe('image-url-extractor', () => {
  it('extracts markdown image urls and plain https urls', () => {
    const text = [
      'Imagem: ![A](https://cdn.example.com/a.png)',
      'URL: https://cdn.example.com/b.jpg',
    ].join('\n');
    expect(extractImageUrlsFromText(text)).toEqual([
      'https://cdn.example.com/a.png',
      'https://cdn.example.com/b.jpg',
    ]);
  });

  it('dedupes and keeps only https urls', () => {
    expect(
      dedupeHttpsImageUrls([
        'https://cdn.example.com/a.png',
        'https://cdn.example.com/a.png',
        'http://cdn.example.com/insecure.png',
      ]),
    ).toEqual(['https://cdn.example.com/a.png']);
  });
});
