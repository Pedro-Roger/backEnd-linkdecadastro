import { PrismaService } from '../prisma/prisma.service';
export declare class ShareService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getCoursePreviewData(courseIdOrSlug: string): Promise<{
        id: string;
        title: string;
        description: string | null;
        bannerUrl: string | null;
        slug: string | null;
    }>;
    getEventPreviewData(eventId: string): Promise<{
        id: string;
        title: string;
        description: string;
        bannerUrl: string | null;
        linkId: string;
    }>;
    generateOpenGraphHTML(data: {
        title: string;
        description: string | null;
        bannerUrl: string | null;
        url: string;
        type?: string;
    }): string;
    private escapeHtml;
}
