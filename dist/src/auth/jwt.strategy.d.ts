import { Strategy } from 'passport-jwt';
export interface JwtPayload {
    sub: string;
    email: string;
    role: string;
    needsProfileCompletion?: boolean;
    phone?: string | null;
    state?: string | null;
    city?: string | null;
}
declare const JwtStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class JwtStrategy extends JwtStrategy_base {
    constructor();
    validate(payload: JwtPayload): Promise<{
        id: string;
        email: string;
        role: string;
        needsProfileCompletion: boolean | undefined;
        phone: string | null | undefined;
        state: string | null | undefined;
        city: string | null | undefined;
    }>;
}
export {};
