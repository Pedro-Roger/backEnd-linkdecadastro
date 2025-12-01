import type { Response } from 'express';
import { ShareService } from './share.service';
export declare class ShareController {
    private readonly shareService;
    constructor(shareService: ShareService);
    getCourseShare(courseId: string, res: Response): Promise<void>;
    getEventShare(eventIdOrSlug: string, res: Response): Promise<void>;
    getEnrollShare(courseSlugOrId: string, res: Response): Promise<void>;
}
