export declare class AdminUploadController {
    private getUploadPath;
    uploadBanner(file: Express.Multer.File, req: any): Promise<{
        url: string;
        filename: string;
    }>;
}
