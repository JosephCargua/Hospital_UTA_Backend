import { Controller, Post, Get, Delete, Body, Req, UseGuards, HttpException, HttpStatus, Param, Query } from '@nestjs/common';
import { EvaluationsService } from './evaluations.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Controller('evaluations')
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  // Unity descarga la evaluación activa
  @Get('active')
  async getActiveEvaluations(@Query('user_id') userId: string) {
    try {
      return await this.evaluationsService.getActiveEvaluations(userId);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Frontend (Docente/Admin) lista sus evaluaciones
  @UseGuards(JwtAuthGuard)
  @Get('docente')
  async getEvaluationsByDocente(@Req() req: any) {
    try {
      const userId = req.user.userId;
      return await this.evaluationsService.getEvaluationsByDocente(userId);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Frontend (Docente/Admin) ve los detalles de una evaluación
  @UseGuards(JwtAuthGuard)
  @Get(':id/details')
  async getEvaluationDetails(@Param('id') id: string) {
    try {
      return await this.evaluationsService.getEvaluationDetails(id);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Frontend (Docente/Admin) cierra manualmente una evaluación
  @UseGuards(JwtAuthGuard)
  @Post(':id/close')
  async closeEvaluation(@Param('id') id: string, @Req() req: any) {
    try {
      const userId = req.user.userId;
      return await this.evaluationsService.closeEvaluation(id, userId);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Frontend (Docente/Admin) elimina una evaluación y sus datos asociados
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteEvaluation(@Param('id') id: string) {
    try {
      return await this.evaluationsService.deleteEvaluation(id);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Frontend (Docente/Admin) crea una evaluación
  @UseGuards(JwtAuthGuard)
  @Post('create')
  async createEvaluation(@Body() data: any, @Req() req: any) {
    try {
      const userId = req.user.userId;
      return await this.evaluationsService.createEvaluation(data, userId);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Unity envía las respuestas de una evaluación
  // Soportamos tanto /:id/submit (REST) como /submit con id en body (Unity bug)
  @Post(':id/submit')
  async submitAnswersParam(@Param('id') id: string, @Body() data: any) {
    try {
      const userId = data.user_id; // Viene del payload de Unity
      return await this.evaluationsService.submitAnswers(id, userId, data.answers);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('submit')
  async submitAnswersBody(@Body() data: any) {
    try {
      const id = data.evaluation_id;
      const userId = data.user_id;
      return await this.evaluationsService.submitAnswers(id, userId, data.answers);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
