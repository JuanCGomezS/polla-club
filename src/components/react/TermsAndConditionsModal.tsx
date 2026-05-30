import Modal from './Modal';

interface TermsAndConditionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TermsAndConditionsModal({ isOpen, onClose }: TermsAndConditionsModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Términos y Condiciones de PollaClub">
      <div className="space-y-4 text-sm text-[color:var(--pc-muted)] leading-relaxed">
        <p>
          Al registrarte y usar PollaClub, aceptas íntegramente estos Términos y Condiciones para la creación, administración y participación en grupos de pronósticos deportivos.
        </p>

        <div>
          <p className="font-semibold text-[color:var(--pc-text-on-dark)] mb-1">1. Objeto del servicio</p>
          <p>
            PollaClub es una plataforma digital para gestionar competencias de pronósticos deportivos entre usuarios. La plataforma facilita el registro de pronósticos, el bloqueo automático por horario, el cálculo de puntajes y la visualización de tablas.
          </p>
        </div>

        <div>
          <p className="font-semibold text-[color:var(--pc-text-on-dark)] mb-1">2. Condiciones de uso y responsabilidad</p>
          <ul className="list-disc list-inside space-y-1">
            <li>El usuario declara que la información suministrada en su cuenta es veraz y actualizada.</li>
            <li>El administrador de cada grupo es responsable de invitar participantes y definir las reglas internas de convivencia.</li>
            <li>Los pronósticos se bloquean automáticamente al inicio de cada partido y no pueden editarse luego del cierre.</li>
            <li>Los resultados y puntajes se calculan automáticamente según la configuración de cada grupo.</li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-[color:var(--pc-text-on-dark)] mb-1">3. Pagos, planes y reembolsos</p>
          <ul className="list-disc list-inside space-y-1">
            <li>El pago del plan habilita la creación y gestión del grupo en PollaClub.</li>
            <li>
              El reembolso solo aplica cuando exista un error crítico, verificable y atribuible a la plataforma que impida de forma efectiva realizar la competencia contratada.
            </li>
            <li>
              En cualquier otro caso no se realizan reembolsos, incluyendo, sin limitarse a: cambios de decisión, falta de uso, abandono del grupo o decisiones internas de los participantes.
            </li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-[color:var(--pc-text-on-dark)] mb-1">4. Premiación</p>
          <p>
            PollaClub no organiza, administra, custodia ni garantiza premios o bolsas económicas. La premiación es un acuerdo interno y responsabilidad exclusiva de cada grupo.
          </p>
        </div>

        <div>
          <p className="font-semibold text-[color:var(--pc-text-on-dark)] mb-1">5. Tratamiento de datos personales</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Para crear y operar la cuenta, PollaClub solicita y trata datos personales básicos: nombre y correo electrónico.</li>
            <li>Estos datos se utilizan para autenticación, identificación del usuario dentro de los grupos, comunicación operativa y funcionamiento del servicio.</li>
            <li>PollaClub adopta medidas razonables de seguridad para proteger la información; sin embargo, ningún sistema es absolutamente infalible.</li>
            <li>El usuario puede solicitar actualización o eliminación de su información en los casos permitidos por la normativa aplicable y las obligaciones técnicas/legales vigentes.</li>
            <li>Al registrarte, autorizas el tratamiento de tus datos personales para las finalidades aquí descritas.
            </li>
          </ul>
        </div>

        <div>
          <p className="font-semibold text-[color:var(--pc-text-on-dark)] mb-1">6. Aceptación</p>
          <p>
            La creación de cuenta y/o uso continuado de la plataforma constituye aceptación expresa de estos Términos y Condiciones.
          </p>
        </div>
      </div>
    </Modal>
  );
}
