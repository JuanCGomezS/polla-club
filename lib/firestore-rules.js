rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ============================================
    // HELPER FUNCTIONS
    // ============================================
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isGroupParticipant(groupId) {
      let group = get(/databases/$(database)/documents/groups/$(groupId));
      return request.auth.uid in group.data.participants || 
             request.auth.uid == group.data.adminUid;
    }
    
    function isGroupAdmin(groupId) {
      let group = get(/databases/$(database)/documents/groups/$(groupId));
      return request.auth.uid == group.data.adminUid;
    }
    
    function isMatchScheduled(matchId) {
      let matchDoc = get(/databases/$(database)/documents/matches/$(matchId));
      return matchDoc.data.status == 'scheduled';
    }
    
    function isBonusLocked(competitionId) {
      // Verificar si los pronósticos bonus están bloqueados para esta competición
      let competition = get(/databases/$(database)/documents/competitions/$(competitionId));
      let results = get(/databases/$(database)/documents/competitions/$(competitionId)/results/main);
      return (exists(results) && results.data.isLocked) || 
             (exists(competition) && 
              competition.data.bonusSettings != null &&
              competition.data.bonusSettings.bonusLockDate != null && 
              competition.data.bonusSettings.bonusLockDate < request.time);
    }
    
    // NUEVO: Verifica si el usuario tiene permiso para crear grupos
    function canUserCreateGroups() {
      let userDocPath = /databases/$(database)/documents/users/$(request.auth.uid);
      // Verificar que el documento existe
      return exists(userDocPath) && 
             get(userDocPath).data.canCreateGroups == true;
    }
    
    // ============================================
    // COMPETITIONS (lectura pública, escritura solo super admin)
    // ============================================
    match /competitions/{competitionId} {
      allow read: if true;  // Cualquiera puede leer competiciones
      allow write: if false;  // Solo super admin manual
      
      // Resultados de la competición
      match /results/{resultId} {
        allow read: if true;  // Lectura pública
        allow write: if false;  // Solo super admin manual
      }
    }
    
    // ============================================
    // MATCHES (lectura pública, escritura solo super admin)
    // ============================================
    match /matches/{matchId} {
      allow read: if true;  // Cualquiera puede leer partidos
      allow write: if false;  // Solo desde Cloud Functions o super admin manual
    }
    
    // ============================================
    // GROUPS
    // ============================================
    match /groups/{groupId} {
      // Leer: solo participantes y admin del grupo
      // Nota: Para queries con array-contains, no usar isGroupParticipant() con get()
      // En su lugar, verificar directamente en la regla
      allow read: if isAuthenticated() && (
        request.auth.uid in resource.data.participants || 
        request.auth.uid == resource.data.adminUid
      );
      
      // CREAR: Solo usuarios con permiso canCreateGroups = true
      // Además, el adminUid debe ser el usuario autenticado
      allow create: if isAuthenticated() && 
                       canUserCreateGroups() &&
                       request.resource.data.adminUid == request.auth.uid;
      
      // Actualizar: solo admin del grupo
      // No permitir cambiar settings después de crear (integridad)
      allow update: if isAuthenticated() && isGroupAdmin(groupId) &&
                      // No permitir cambiar settings si el documento ya existe
                      (!exists(resource) || 
                       (resource.data.keys().hasAll(['settings']) && 
                        request.resource.data.keys().hasAll(['settings']) &&
                        resource.data.settings.pointsExactScore == request.resource.data.settings.pointsExactScore &&
                        resource.data.settings.pointsWinner == request.resource.data.settings.pointsWinner));
      
      // ============================================
      // PREDICTIONS (pronósticos de partidos)
      // ============================================
      match /predictions/{predictionId} {
        // Leer:
        // - El dueño siempre puede leer
        // - Cualquier participante puede leer si el partido ya inició
        allow read: if isAuthenticated() && isGroupParticipant(groupId) && (
          resource.data.userId == request.auth.uid ||
          !isMatchScheduled(resource.data.matchId)
        );
        
        // Crear/Actualizar:
        // - Solo el dueño
        // - Solo si el partido está scheduled
        allow create, update: if isAuthenticated() && 
                                 isGroupParticipant(groupId) &&
                                 request.resource.data.userId == request.auth.uid &&
                                 isMatchScheduled(request.resource.data.matchId);
        
        // No permitir eliminar (por integridad)
        allow delete: if false;
      }
      
      // ============================================
      // BONUS PREDICTIONS (pronósticos bonus)
      // ============================================
      match /bonusPredictions/{bonusId} {
        // Leer: todos los participantes del grupo
        allow read: if isAuthenticated() && isGroupParticipant(groupId);
        
        // Crear/Actualizar:
        // - Solo el dueño
        // - Solo si aún no se bloqueó (según configuración de la competición)
        allow create, update: if isAuthenticated() && 
                                 isGroupParticipant(groupId) &&
                                 request.resource.data.userId == request.auth.uid &&
                                 !isBonusLocked(get(/databases/$(database)/documents/groups/$(groupId)).data.competitionId);
        
        allow delete: if false;
      }
    }
    
    // ============================================
    // USERS
    // ============================================
    match /users/{userId} {
      // Leer: cualquier usuario autenticado (para ver nombres)
      allow read: if isAuthenticated();
      
      // Crear: solo el mismo usuario al registrarse
      // IMPORTANTE: canCreateGroups debe ser false por defecto
      allow create: if isAuthenticated() && 
                       request.auth.uid == userId &&
                       request.resource.data.canCreateGroups == false;
      
      // Actualizar: solo el mismo usuario
      // IMPORTANTE: canCreateGroups solo puede ser actualizado manualmente por el super admin
      // Los usuarios NO pueden cambiar su propio canCreateGroups
      allow update: if isAuthenticated() && 
                       request.auth.uid == userId &&
                       (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['canCreateGroups']));
    }
    
  }
}
