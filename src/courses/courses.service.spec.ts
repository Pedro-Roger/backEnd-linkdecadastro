import { CoursesService } from './courses.service';

describe('CoursesService', () => {
  const createService = () => {
    const prisma: any = {
      user: {
        findFirst: jest.fn(),
      },
      enrollment: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const coursesRepository: any = {};
    const enrollmentsRepository: any = {};

    const service = new CoursesService(
      prisma,
      coursesRepository,
      enrollmentsRepository,
    );

    return { service, prisma };
  };

  it('returns prefill data and duplicate enrollment details when CPF is already enrolled in the course', async () => {
    const { service, prisma } = createService();
    const createdAt = new Date('2026-03-26T14:30:00.000Z');

    prisma.enrollment.findFirst.mockResolvedValue({
      id: 'enrollment-1',
      status: 'CONFIRMED',
      createdAt,
      user: {
        name: 'Maria da Silva',
        email: 'maria@example.com',
        phone: '11999999999',
        cpf: '12345678901',
        birthDate: new Date('1990-01-10T00:00:00.000Z'),
        participantType: 'PROFESSOR',
        schoolOrUniversity: 'Escola Estadual',
        hectares: null,
        waterArea: null,
        ponds: null,
        state: 'SP',
        city: 'Sao Paulo',
      },
    });

    const result = await (service as any).findEnrollmentContextByCpf(
      'course-1',
      '12345678901',
    );

    expect(result).toEqual({
      profile: expect.objectContaining({
        name: 'Maria da Silva',
        email: 'maria@example.com',
        whatsappNumber: '11999999999',
        state: 'SP',
        city: 'Sao Paulo',
      }),
      existingEnrollment: {
        id: 'enrollment-1',
        status: 'CONFIRMED',
        createdAt,
      },
    });
  });

  it('includes the original enrollment date when the user is already enrolled', async () => {
    const { service, prisma } = createService();
    const createdAt = new Date('2026-03-25T18:00:00.000Z');

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        course: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'course-1',
            title: 'Curso teste',
            status: 'ACTIVE',
            regionQuotas: [],
          }),
        },
        enrollment: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'enrollment-1',
            status: 'CONFIRMED',
            createdAt,
          }),
        },
      }),
    );

    const result = await service.enrollInCourse('user-1', 'course-1', {
      whatsappNumber: '11999999999',
    });

    expect(result).toEqual({
      error: {
        message: expect.stringContaining('inscrito neste curso'),
        status: 409,
        existingEnrollment: {
          id: 'enrollment-1',
          status: 'CONFIRMED',
          createdAt,
        },
      },
    });
  });
});

