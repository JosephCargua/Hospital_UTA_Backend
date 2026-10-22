import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class EvaluationsService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    );
  }

  // Crear una nueva evaluación con sus preguntas
  async createEvaluation(data: any, userId: string) {
    const { title, description, questions, semestre, paralelo } = data;

    // Desactivar evaluaciones anteriores activas para este semestre y paralelo
    if (semestre && paralelo) {
      await this.supabase
        .from('evaluations')
        .update({ is_active: false })
        .eq('semestre', semestre)
        .eq('paralelo', paralelo)
        .eq('is_active', true);
    }

    // Insertar la evaluación
    const { data: evalData, error: evalError } = await this.supabase
      .from('evaluations')
      .insert([{ 
        title, 
        description, 
        created_by: userId, 
        is_active: true,
        semestre,
        paralelo
      }])
      .select()
      .single();

    if (evalError) throw new Error(evalError.message);

    // Insertar las preguntas
    if (questions && questions.length > 0) {
      const questionsToInsert = questions.map((q) => ({
        evaluation_id: evalData.id,
        question_text: q.question_text,
        image_url: q.image_url || null,
        options: q.options,
        correct_option_index: q.correct_option_index,
      }));

      const { error: questionsError } = await this.supabase
        .from('evaluation_questions')
        .insert(questionsToInsert);

      if (questionsError) throw new Error(questionsError.message);
    }

    return evalData;
  }

  // Obtener la evaluación activa para el estudiante filtrada por semestre y paralelo
  async getActiveEvaluations(userId?: string) {
    let studentSemestre = null;
    let studentParalelo = null;

    if (userId && userId !== 'unknown') {
      const { data: studentDetails } = await this.supabase
        .from('detalles_estudiantes')
        .select('semestre, paralelo')
        .eq('usuario_id', userId)
        .single();
      
      if (studentDetails) {
        studentSemestre = studentDetails.semestre;
        studentParalelo = studentDetails.paralelo;
      }
    }

    let query = this.supabase
      .from('evaluations')
      .select('id, title, description, semestre, paralelo, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (studentSemestre && studentParalelo) {
      query = query
        .eq('semestre', studentSemestre)
        .eq('paralelo', studentParalelo);
    }

    const { data: evaluations, error: evalError } = await query;

    if (evalError) throw new Error(evalError.message);

    const result: any[] = [];

    for (const ev of evaluations) {
      // Si el estudiante ya respondió a esta evaluación, no se le debe mostrar
      if (userId && userId !== 'unknown') {
        const { data: existingSub } = await this.supabase
          .from('evaluation_submissions')
          .select('id')
          .eq('evaluation_id', ev.id)
          .eq('student_id', userId)
          .limit(1);

        if (existingSub && existingSub.length > 0) {
          continue;
        }
      }

      const { data: questions, error: qError } = await this.supabase
        .from('evaluation_questions')
        .select('id, question_text, image_url, options, correct_option_index')
        .eq('evaluation_id', ev.id);
      
      if (!qError && questions && questions.length > 0) {
        result.push({ ...ev, questions });
      }
    }

    return result.length > 0 ? result[0] : null;
  }
  
  // Obtener evaluaciones creadas por un docente para listarlas en Frontend
  async getEvaluationsByDocente(userId: string) {
    const { data: evaluations, error } = await this.supabase
      .from('evaluations')
      .select('id, title, description, semestre, paralelo, is_active, created_at')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    // Determinar si están finalizadas
    const result: any[] = [];
    for (const ev of evaluations) {
      // Contar estudiantes en ese semestre/paralelo
      const { count: totalStudents, error: stuError } = await this.supabase
        .from('usuarios')
        .select('id', { count: 'exact', head: true })
        .eq('rol_id', 3)
        .eq('estado', 'activo');

      if (stuError) {
        console.error("Error fetching students count:", stuError);
      }

      // Consultar detalles_estudiantes y filtrar por paralelo y semestre
      const { data: details, error: detError } = await this.supabase
        .from('detalles_estudiantes')
        .select('usuario_id')
        .eq('semestre', ev.semestre || '')
        .eq('paralelo', ev.paralelo || '');
      
      const totalInParallel = details ? details.length : 0;

      // Contar submissions y scores
      const { data: subsData } = await this.supabase
        .from('evaluation_submissions')
        .select('score')
        .eq('evaluation_id', ev.id);

      const submissions = subsData ? subsData.length : 0;
      const scores = subsData ? subsData.map((s) => parseFloat(s.score)).filter((n) => !isNaN(n)) : [];
      const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : null;

      let finalizada = false;
      if (totalInParallel > 0 && submissions >= totalInParallel) {
        finalizada = true;
      }
      
      // Actualizar estado si cambió
      if (finalizada && ev.is_active) {
        await this.supabase.from('evaluations').update({ is_active: false }).eq('id', ev.id);
        ev.is_active = false;
      }

      result.push({
        ...ev,
        estado: ev.is_active ? 'Activa' : 'Finalizada',
        total_students: totalInParallel,
        submissions_count: submissions,
        avg_score: avgScore,
        scores: scores
      });
    }

    return result;
  }

  // Cerrar manualmente una evaluación
  async closeEvaluation(id: string, userId: string) {
    const { data: evaluation, error: fetchError } = await this.supabase
      .from('evaluations')
      .select('created_by')
      .eq('id', id)
      .single();

    if (fetchError || !evaluation) {
      throw new Error('Evaluación no encontrada');
    }

    if (evaluation.created_by !== userId) {
      // Validate that the user closing it is the owner
    }

    const { error: updateError } = await this.supabase
      .from('evaluations')
      .update({ is_active: false })
      .eq('id', id);

    if (updateError) throw new Error(updateError.message);
    return { message: 'Evaluación cerrada exitosamente' };
  }

  // Eliminar una evaluación y todos sus datos relacionados
  async deleteEvaluation(id: string) {
    // 1. Eliminar respuestas/envíos de estudiantes si existen
    await this.supabase
      .from('evaluation_submissions')
      .delete()
      .eq('evaluation_id', id);

    // 2. Eliminar preguntas asociadas
    await this.supabase
      .from('evaluation_questions')
      .delete()
      .eq('evaluation_id', id);

    // 3. Eliminar la evaluación
    const { error: evalError } = await this.supabase
      .from('evaluations')
      .delete()
      .eq('id', id);

    if (evalError) throw new Error(evalError.message);
    return { message: 'Evaluación eliminada exitosamente' };
  }

  // Detalle de evaluación para el docente
  async getEvaluationDetails(id: string) {
    const { data: evaluation, error: evalError } = await this.supabase
      .from('evaluations')
      .select('*')
      .eq('id', id)
      .single();

    if (evalError) throw new Error(evalError.message);

    const { data: questions, error: qError } = await this.supabase
      .from('evaluation_questions')
      .select('*')
      .eq('evaluation_id', id);

    if (qError) throw new Error(qError.message);

    let submissions: any[] = [];
    const { data: subData, error: subError } = await this.supabase
      .from('evaluation_submissions')
      .select('*, usuarios(nombres, apellidos)')
      .eq('evaluation_id', id);

    if (!subError && subData) {
      submissions = subData;
    } else {
      if (subError) console.error('Aviso en join de submissions:', subError.message);
      // Fallback robusto: consultar submissions y buscar nombres directamente si falla el embedding
      const { data: rawSubs } = await this.supabase
        .from('evaluation_submissions')
        .select('*')
        .eq('evaluation_id', id);

      if (rawSubs && rawSubs.length > 0) {
        const userIds = rawSubs.map((s) => s.student_id);
        const { data: users } = await this.supabase
          .from('usuarios')
          .select('id, nombres, apellidos')
          .in('id', userIds);

        const userMap = new Map((users || []).map((u) => [u.id, u]));
        submissions = rawSubs.map((s) => ({
          ...s,
          usuarios: userMap.get(s.student_id) || { nombres: 'Estudiante', apellidos: '' },
        }));
      }
    }

    const { data: details } = await this.supabase
      .from('detalles_estudiantes')
      .select('usuario_id')
      .eq('semestre', evaluation.semestre)
      .eq('paralelo', evaluation.paralelo);
    
    const total_students = details ? details.length : 0;

    return {
      ...evaluation,
      total_students,
      questions: questions || [],
      submissions: submissions || []
    };
  }

  // Enviar respuestas y calcular la nota final
  async submitAnswers(evaluationId: string, userId: string, answers: any[]) {
    const { data: questions, error } = await this.supabase
      .from('evaluation_questions')
      .select('id, correct_option_index')
      .eq('evaluation_id', evaluationId);

    if (error) throw new Error(error.message);

    let correctCount = 0;
    const totalQuestions = questions.length;

    // Obtenemos las preguntas ordenadas por ID
    const { data: orderedQuestions } = await this.supabase
      .from('evaluation_questions')
      .select('id, correct_option_index')
      .eq('evaluation_id', evaluationId)
      .order('id', { ascending: true });

    const safeOrderedQuestions = orderedQuestions || [];

    answers.forEach((ans) => {
      const qIndex = ans.question_index;
      const qObj = safeOrderedQuestions[qIndex];
      
      let selectedIndex = -1;
      if (ans.selected_option === 'a') selectedIndex = 0;
      else if (ans.selected_option === 'b') selectedIndex = 1;
      else if (ans.selected_option === 'c') selectedIndex = 2;
      else if (ans.selected_option === 'd') selectedIndex = 3;
      else selectedIndex = ans.selected_index; // fallback por si es el frontend web

      if (qObj && qObj.correct_option_index === selectedIndex) {
        correctCount++;
      }
    });

    const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 10 : 0; // Nota sobre 10

    // Guardar en la base de datos
    if (userId && userId !== 'unknown') {
      const { data: subData, error: subError } = await this.supabase
        .from('evaluation_submissions')
        .insert([{
          evaluation_id: evaluationId,
          student_id: userId,
          score: score
        }])
        .select();

      if (subError) {
        console.error('Error al registrar submission en Supabase:', subError);
        throw new Error(`Error al registrar entrega: ${subError.message}`);
      }
    }

    return {
      total_questions: totalQuestions,
      correct_answers: correctCount,
      score: score.toFixed(2)
    };
  }
}
