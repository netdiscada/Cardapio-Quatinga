import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

// ============================================================
// 1. Novo pedido em pedidosDaSemana -> notifica ADMIN
// ============================================================
export const onNewOrder = functions.firestore
  .document('pedidosDaSemana/{docId}')
  .onCreate(async (snap, context) => {
    const order = snap.data();
    const employeeName = order.employeeName || 'Funcionário';
    const employeeRGF = order.employeeRGF || '';
    const isNextWeek = order.isNextWeek === true;

    console.log(`[onNewOrder] Novo pedido: ${employeeName} (RGF ${employeeRGF}), próxima=${isNextWeek}`);

    // Só notifica admin se for pedido antecipado (próxima semana)
    if (!isNextWeek) {
      console.log('[onNewOrder] Pedido da semana atual, não notifica admin');
      return null;
    }

    // Busca tokens do admin
    const adminTokens: string[] = [];
    const tokensSnap = await db.collection('deviceTokens')
      .where('role', '==', 'admin')
      .where('active', '==', true)
      .get();

    tokensSnap.forEach(doc => {
      const data = doc.data();
      if (data.token) adminTokens.push(data.token);
    });

    if (adminTokens.length === 0) {
      console.log('[onNewOrder] Nenhum token de admin cadastrado');
      return null;
    }

    const payload: admin.messaging.MulticastMessage = {
      tokens: adminTokens,
      notification: {
        title: '📋 Novo Pedido Antecipado',
        body: `${employeeName} fez o pedido para a próxima semana.`,
      },
      data: {
        type: 'new_order',
        employeeRGF,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
    };

    try {
      const response = await messaging.sendMulticast(payload);
      console.log(`[onNewOrder] Enviado: ${response.successCount} sucesso, ${response.failureCount} falha`);
      return response;
    } catch (err) {
      console.error('[onNewOrder] Erro ao enviar FCM:', err);
      return null;
    }
  });

// ============================================================
// 2. Atualização do cardapio/semanal -> notifica FUNCIONÁRIOS
// ============================================================
export const onMenuUpdate = functions.firestore
  .document('cardapio/semanal')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    const beforeImage = before?.menuImageBase64 || '';
    const afterImage = after?.menuImageBase64 || '';
    const beforeNext = before?.nextMenuImageBase64 || '';
    const afterNext = after?.nextMenuImageBase64 || '';

    // Só notifica se a imagem mudou
    if (beforeImage === afterImage && beforeNext === afterNext) {
      console.log('[onMenuUpdate] Imagem não mudou, não notifica');
      return null;
    }

    const hasNext = !!afterNext;
    console.log(`[onMenuUpdate] Cardapio atualizado: proximaSemana=${hasNext}`);

    // Busca tokens de funcionários
    const funcionarioTokens: string[] = [];
    const tokensSnap = await db.collection('deviceTokens')
      .where('role', '==', 'funcionario')
      .where('active', '==', true)
      .get();

    tokensSnap.forEach(doc => {
      const data = doc.data();
      if (data.token) funcionarioTokens.push(data.token);
    });

    if (funcionarioTokens.length === 0) {
      console.log('[onMenuUpdate] Nenhum token de funcionário cadastrado');
      return null;
    }

    const payload: admin.messaging.MulticastMessage = {
      tokens: funcionarioTokens,
      notification: {
        title: hasNext
          ? '📅 Cardápio da Próxima Semana Disponível!'
          : '🍽️ Novo Cardápio da Semana!',
        body: hasNext
          ? 'O cardápio antecipado já está no app. Escolha seus pratos!'
          : 'O cardápio desta semana foi atualizado. Faça seu pedido.',
      },
      data: {
        type: 'new_menu',
        isNextWeek: String(hasNext),
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
    };

    try {
      const response = await messaging.sendMulticast(payload);
      console.log(`[onMenuUpdate] Enviado: ${response.successCount} sucesso, ${response.failureCount} falha`);
      return response;
    } catch (err) {
      console.error('[onMenuUpdate] Erro ao enviar FCM:', err);
      return null;
    }
  });
