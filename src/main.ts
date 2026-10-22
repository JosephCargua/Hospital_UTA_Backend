import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Aumentar el límite de tamaño para payloads con imágenes en Base64 (evaluaciones)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  // Habilitar CORS para que tu React y las gafas VR puedan conectarse sin bloqueos
  app.enableCors();

  // Configuración de validaciones globales
  app.useGlobalPipes(new ValidationPipe());

  // Configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('Hospital Universitario UTA - API')
    .setDescription('Sistema de autenticación y gestión para simulador virtual')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // CORRECCIÓN CRÍTICA PARA RAILWAY: Captura el puerto dinámico y expone el Host universal
  const puerto = process.env.PORT ?? 3000;
  await app.listen(puerto, '0.0.0.0'); 
  
  console.log(`🚀 Servidor operativo en el puerto: ${puerto}`);
  console.log(`📖 Documentación Swagger habilitada en el entorno`);
}
bootstrap();
