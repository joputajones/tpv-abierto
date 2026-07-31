'use strict';

const { getNpmInvocation, runCommand } = require('../scripts/process-runner.cjs');

const TEST_SCRIPTS = Object.freeze([
  'test:smoke',
  'test:kds-integration',
  'test:kds-contract',
  'test:cors',
  'test:release-config',
  'test:first-run',
  'test:security',
  'test:staff-authz',
  'test:orders-authz',
  'test:authz-phase3',
  'test:customer-auth',
  'test:customer-pagination',
  'test:backup',
  'test:printer',
  'test:translations',
  'test:phone',
  'test:currency',
  'test:tax-engine',
  'test:tax-components',
  'test:tax-pack-management',
  'test:customer-phone-search',
  'test:phone-search-integration',
  'test:receipt-column-width',
  'test:notes-validation',
  'test:receipt-printing',
  'test:cancel-override',
  'test:kitchen-addons',
  'test:order-item-addons',
  'test:issue-125-addon-reads',
  'test:windows-country-code-crash',
  'test:reports-insights',
  'test:sequence',
  'test:integration-happy',
  'test:integration-tax',
  'test:integration-payments',
  'test:integration-lifecycle',
  'test:restart-recovery',
  'test:integration-reconciliation',
  'test:integration-loyalty',
  'test:integration-discount',
  'test:loyalty-toggle',
  'test:discount-system',
  'test:integration-discount-settings',
  'test:integration-loyalty-global',
  'test:integration-loyalty-redemption',
  'test:bills-print-api',
  'test:issue-24',
  'test:issue-134-routing',
  'test:issue-134-mgmt',
  'test:issue-137-barcode',
  'test:tables-string-ids',
  'test:held-orders',
  'test:schema-health',
  'test:migration-backup-fail-closed',
  'test:upgrade-path',
  'test:master-pin',
  'test:google-drive',
  'test:database-tools-api',
  'test:phone-validation',
  'test:phone-migration',
  'test:issue-133-kds-kot-toggles',
  'test:whatsapp-schema',
  'test:whatsapp-service',
  'test:whatsapp-middleware',
  'test:issue-127-password-recovery',
  'test:dev-tooling',
  'test:cross-platform-scripts',
]);

async function runTestScripts(scripts = TEST_SCRIPTS, options = {}) {
  const invocation = options.invocation ?? getNpmInvocation();
  const run = options.run ?? runCommand;
  const logger = options.logger ?? console;

  for (const script of scripts) {
    logger.log(`\n=== ${script} ===`);
    let result;
    try {
      result = await run(invocation.command, [...invocation.argsPrefix, 'run', script]);
    } catch (error) {
      logger.error(`[test-runner] Could not start npm run ${script}: ${error.message}`);
      return { code: 1, signal: null, failedScript: script };
    }

    if (result.exitCode === 77) {
      logger.log('  Skipped (ABI mismatch)');
      continue;
    }

    if (result.exitCode !== 0) {
      const reason = result.signal ? `signal ${result.signal}` : `exit code ${result.exitCode}`;
      logger.error(`[test-runner] npm run ${script} failed with ${reason}.`);
      return { code: result.exitCode, signal: result.signal, failedScript: script };
    }
  }

  return { code: 0, signal: null, failedScript: null };
}

async function main() {
  const result = await runTestScripts();
  process.exitCode = result.code;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[test-runner] Unexpected failure: ${error.stack ?? error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  TEST_SCRIPTS,
  runTestScripts,
};
