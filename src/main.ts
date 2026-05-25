import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: configService.get<string>('SOCKET_CORS_ORIGIN', '*'),
  });

  const port = configService.get<number>('PORT', 3001);
  await app.listen(port);
  console.log(`Kiosk Socket Service running on port ${port}`);
}

bootstrap();
