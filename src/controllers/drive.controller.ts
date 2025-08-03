import { Controller, Get, Param, Res, Logger, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { Response, Request } from 'express';
import { DriveService } from '../services/drive.service';
import { FirebaseAuthGuard } from '../processes/auth/guards/firebase-auth.guard';
import axios, { AxiosError } from 'axios';

@Controller('admin/drive')
export class DriveController {
    private readonly logger = new Logger(DriveController.name);

    constructor(private readonly driveService: DriveService) { }

    @Get('video/:fileId')
    @UseGuards(FirebaseAuthGuard)
    async streamVideo(
        @Param('fileId') fileId: string,
        @Req() req: Request,
        @Res() res: Response
    ) {
        try {
            this.logger.debug(`Streaming video for fileId: ${fileId}`);
            const drive = this.driveService.getDriveInstance();

            // Add authorization check
            //if (!req.user) {
            //return res.status(HttpStatus.UNAUTHORIZED).json({
            //status: false,
            //message: 'Authentication required'
            //});
            //}

            const file = await drive.files.get({
                fileId,
                alt: 'media'
            }, {
                responseType: 'stream'
            });

            res.set({
                'Content-Type': 'video/mp4',
                'Content-Disposition': 'inline',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=3600'
            });

            file.data.pipe(res);
        } catch (error) {
            this.logger.error(`Error streaming video ${fileId}:`, error);
            res.status(HttpStatus.NOT_FOUND).json({
                status: false,
                message: 'Video not found or inaccessible',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    // Get video info without streaming
    @Get('video-info/:fileId')
    async getVideoInfo(@Param('fileId') fileId: string, @Res() res: Response) {
        try {
            const drive = this.driveService.getDriveInstance();
            const fileMetadata = await drive.files.get({
                fileId,
                fields: 'id, name, mimeType, size'
            });

            res.json({
                status: true,
                data: fileMetadata.data
            });
        } catch (error) {
            this.logger.error(`Error getting video info for ${fileId}:`, error);
            res.status(HttpStatus.NOT_FOUND).json({
                status: false,
                message: 'Video not found or inaccessible'
            });
        }
    }

    @Get('thumbnail/:fileId')
    async getThumbnail(@Param('fileId') fileId: string, @Res() res: Response) {
        try {
            this.logger.debug(`Fetching thumbnail for fileId: ${fileId}`);
            const drive = this.driveService.getDriveInstance();

            // Primero verificar si el archivo existe y es accesible
            const fileMetadata = await drive.files.get({
                fileId,
                fields: 'id, name, mimeType, thumbnailLink'
            });

            if (!fileMetadata.data.thumbnailLink) {
                throw new Error('No thumbnail available for this file');
            }

            // Obtener la miniatura usando el thumbnailLink
            const imageResponse = await axios.get(fileMetadata.data.thumbnailLink, {
                responseType: 'stream',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            res.set({
                'Content-Type': 'image/jpeg',
                'Cache-Control': 'public, max-age=3600',
                'Access-Control-Allow-Origin': '*'
            });

            imageResponse.data.pipe(res);
        } catch (error) {
            this.logger.error(`Error fetching thumbnail for ${fileId}:`, error);
            res.status(HttpStatus.NOT_FOUND).json({
                status: false,
                message: 'Thumbnail not found or inaccessible',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}
