import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

export interface CloudinaryPhoto {
  publicId: string;
  url: string;
}

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }

  async uploadTeamMemberPhoto(
    buffer: Buffer,
    mimeType: string,
  ): Promise<CloudinaryPhoto> {
    this.assertConfigured();
    const result = await cloudinary.uploader.upload(
      `data:${mimeType};base64,${buffer.toString('base64')}`,
      {
        folder: 'ionutadrian91/team-members',
        resource_type: 'image',
      },
    );
    return { publicId: result.public_id, url: result.secure_url };
  }

  async removePhoto(publicId?: string | null): Promise<void> {
    if (!publicId) return;
    this.assertConfigured();
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  }

  private assertConfigured() {
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      throw new ServiceUnavailableException('Cloudinary is not configured');
    }
  }
}
