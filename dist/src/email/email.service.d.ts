export declare class EmailService {
    private readonly transporter;
    constructor();
    sendRegistrationEmail(to: string, name: string, eventTitle: string): Promise<any>;
    sendAdminNotificationEmail(adminEmail: string, registrationData: {
        name: string;
        email: string;
        cpf: string;
        city: string;
        eventTitle: string;
    }): Promise<any>;
}
