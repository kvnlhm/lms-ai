import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { CommunityPostBodyDto } from './community.dto';

describe('CommunityPostBodyDto', () => {
  test('menerima hingga sepuluh lampiran dan menolak yang kesebelas', async () => {
    const sepuluh = plainToInstance(CommunityPostBodyDto, { body: 'Isi', attachmentIds: Array.from({ length: 10 }, () => randomUUID()) });
    const sebelas = plainToInstance(CommunityPostBodyDto, { body: 'Isi', attachmentIds: Array.from({ length: 11 }, () => randomUUID()) });

    await expect(validate(sepuluh)).resolves.toEqual([]);
    await expect(validate(sebelas)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ property: 'attachmentIds' }),
    ]));
  });
});
