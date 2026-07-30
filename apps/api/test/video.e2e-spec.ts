import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import request from 'supertest';
import { firstLessonOf, login, prefix, startHarness, type Harness } from './support/harness';

const MASTER = { email: 'master@akademionline.id', password: 'Master#Lokal12345' };
const STUDENT = { email: 'pelajar@akademionline.id', password: 'Pelajar#Lokal12345' };

describe('Video self-hosted', () => {
  let h: Harness;
  const videoAssetIds: string[] = [];
  const storage = process.env.VIDEO_STORAGE_PATH ?? '/tmp/lms-test-videos';

  beforeAll(async () => {
    h = await startHarness();
  });

  afterAll(async () => {
    if (videoAssetIds.length > 0) {
      await h.prisma.videoPlaybackSession.deleteMany({
        where: { videoAssetId: { in: videoAssetIds } },
      });
      await h.prisma.videoAsset.deleteMany({ where: { id: { in: videoAssetIds } } });
      await Promise.all(
        videoAssetIds.map((videoAssetId) =>
          rm(join(storage, `${videoAssetId}.mp4`), { force: true }),
        ),
      );
    }
    await h.close();
  });

  it('mengunggah MP4 secara streaming dan hanya memberi playback kepada peserta', async () => {
    const master = await login(h.server, MASTER.email, MASTER.password);
    const student = await login(h.server, STUDENT.email, STUDENT.password);
    const lessonId = await firstLessonOf(h.prisma, 'video-editing-mastery');

    // ISO-BMFF minimal untuk menguji signature `ftyp`; transcoding/codec probe
    // dilakukan di pipeline media terpisah ketika provider tersebut ditambahkan.
    const mp4 = Buffer.concat([
      Buffer.from([0, 0, 0, 24]),
      Buffer.from('ftyp'),
      Buffer.from('isom'),
      Buffer.alloc(12),
    ]);

    const intent = await request(h.server)
      .post(`${prefix}/admin/videos/upload-intents`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({
        lessonId,
        title: 'Video test',
        fileName: 'video-test.mp4',
        mimeType: 'video/mp4',
        sizeBytes: mp4.length,
      })
      .expect(201);

    const videoAssetId = intent.body.data.videoAssetId as string;
    videoAssetIds.push(videoAssetId);

    await request(h.server)
      .put(`${prefix}/admin/videos/${videoAssetId}/content`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .set('Content-Type', 'video/mp4')
      .set('Content-Length', String(mp4.length))
      .send(mp4)
      .expect(200);

    const playback = await request(h.server)
      .post(`${prefix}/learn/lessons/${lessonId}/playback-sessions`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken)
      .send({ deviceId: 'e2e-device' })
      .expect(201);

    expect(playback.body.data.drm).toEqual({ enabled: false, type: 'NONE' });
    const playbackId = playback.body.data.playbackSessionId as string;

    const content = await request(h.server)
      .get(`${prefix}/playback-sessions/${playbackId}/content`)
      .set('Cookie', student.cookie)
      .expect(200);

    expect(content.headers['x-accel-redirect']).toBe(`/protected-videos/${videoAssetId}.mp4`);

    // Session playback terikat pada user; Master tidak dapat memakai URL milik
    // Pelajar meskipun memiliki permission pengelolaan course.
    await request(h.server)
      .get(`${prefix}/playback-sessions/${playbackId}/content`)
      .set('Cookie', master.cookie)
      .expect(404);

    const replacementIntent = await request(h.server)
      .post(`${prefix}/admin/videos/upload-intents`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .send({
        lessonId,
        title: 'Video pengganti',
        fileName: 'video-pengganti.mp4',
        mimeType: 'video/mp4',
        sizeBytes: mp4.length,
      })
      .expect(201);

    const replacementId = replacementIntent.body.data.videoAssetId as string;
    videoAssetIds.push(replacementId);

    // Video lama tetap tersedia sampai upload pengganti selesai divalidasi.
    expect(
      await h.prisma.videoAsset.count({
        where: { id: videoAssetId, status: 'AVAILABLE', deletedAt: null },
      }),
    ).toBe(1);

    await request(h.server)
      .put(`${prefix}/admin/videos/${replacementId}/content`)
      .set('Cookie', master.cookie)
      .set('X-CSRF-Token', master.csrfToken)
      .set('Content-Type', 'video/mp4')
      .set('Content-Length', String(mp4.length))
      .send(mp4)
      .expect(200);

    const assets = await h.prisma.videoAsset.findMany({
      where: { id: { in: [videoAssetId, replacementId] } },
      orderBy: { createdAt: 'asc' },
    });
    expect(assets.map(({ status }) => status)).toEqual(['DELETED', 'AVAILABLE']);

    const replacementPlayback = await request(h.server)
      .post(`${prefix}/learn/lessons/${lessonId}/playback-sessions`)
      .set('Cookie', student.cookie)
      .set('X-CSRF-Token', student.csrfToken)
      .send({ deviceId: 'e2e-device-replacement' })
      .expect(201);

    expect(replacementPlayback.body.data.providerVideoId).toBe(
      replacementIntent.body.data.providerVideoId,
    );
  });
});
