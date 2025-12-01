import { Test, TestingModule } from '@nestjs/testing';
import { AdminCoursesService } from './admin-courses.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';

describe('AdminCoursesService', () => {
  let service: AdminCoursesService;
  let prisma: PrismaService;

  const mockPrismaService = {
    course: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    courseRegionQuota: {
      createMany: jest.fn(),
    },
    lesson: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminCoursesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AdminCoursesService>(AdminCoursesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a course with valid data', async () => {
    const courseData: CreateCourseDto = {
      title: 'Test Course',
      slug: 'test-course',
      // Add other required fields if any, though most are optional in DTO
    };

    mockPrismaService.course.findFirst.mockResolvedValue(null);
    mockPrismaService.course.create.mockResolvedValue({ id: 'course-id', ...courseData });
    mockPrismaService.course.findUnique.mockResolvedValue({ id: 'course-id', ...courseData });

    const result = await service.createCourse('user-id', 'ADMIN', courseData);
    expect(result).toBeDefined();
    expect(mockPrismaService.course.create).toHaveBeenCalled();
  });
});
