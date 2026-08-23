import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppConfig } from './common/config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const configService = app.get(ConfigService<AppConfig, true>);
  const logger = app.get(Logger);
  app.useLogger(logger);

  const apiPrefix = configService.get('apiPrefix', { infer: true });
  app.setGlobalPrefix(apiPrefix);

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: configService.get('frontendUrl', { infer: true }),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Marketplace API')
    .setDescription('Multi-vendor marketplace backend — foundation stage')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  const port = configService.get('port', { infer: true });
  await app.listen(port);
  logger.log(`Application listening on port ${port} (prefix: /${apiPrefix})`);
}
void bootstrap();
