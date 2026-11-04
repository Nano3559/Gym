// Agent requirements: Git, Node.js 24.14+ (24.x), npm; no browser or credentials.
def webCommand(String command) {
    if (isUnix()) { sh command } else { bat command }
}

pipeline {
    agent any
    options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
        timestamps()
        timeout(time: 25, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '15'))
    }
    environment {
        CI = 'true'
        TZ = 'UTC'
        VITE_SUPABASE_URL = ''
        VITE_SUPABASE_PUBLISHABLE_KEY = ''
        VITE_GEMINI_API_KEY = ''
        VITE_OPENAI_API_KEY = ''
    }
    stages {
        stage('Descarga desde GitHub') {
            steps {
                // A clean checkout prevents publishing artifacts from an earlier build.
                deleteDir()
                checkout scm
            }
        }
        stage('Instalación') {
            steps {
                dir('frontend-web') {
                    webCommand('node --version')
                    webCommand('npm ci --engine-strict --no-audit --no-fund')
                }
            }
        }
        stage('Análisis de código') {
            steps { dir('frontend-web') { webCommand('npm run lint') } }
        }
        stage('Pruebas automatizadas') {
            steps {
                // Preserve FAILURE while allowing coverage/build and post publication.
                catchError(buildResult: 'FAILURE', stageResult: 'FAILURE', catchInterruptions: false) {
                    dir('frontend-web') {
                        webCommand('npm run test:ci:reporting')
                        webCommand('npm run test:ci')
                    }
                }
            }
        }
        stage('Cobertura de código') {
            steps {
                catchError(buildResult: 'FAILURE', stageResult: 'FAILURE', catchInterruptions: false) {
                    dir('frontend-web') { webCommand('npm run coverage:ci') }
                }
            }
        }
        stage('Compilación') {
            steps { dir('frontend-web') { webCommand('npm run build') } }
        }
    }
    post {
        always {
            // Each publisher runs even if another publisher fails.
            script {
                try {
                    if (fileExists('frontend-web/reports/junit.xml')) {
                        junit testResults: 'frontend-web/reports/junit.xml', allowEmptyResults: false
                    }
                } finally {
                    try {
                        if (fileExists('frontend-web/reports/coverage/index.html')) {
                            publishHTML(target: [reportDir: 'frontend-web/reports/coverage',
                                reportFiles: 'index.html', reportName: 'Cobertura de código web',
                                keepAll: true, alwaysLinkToLastBuild: true, allowMissing: false])
                        }
                    } finally {
                        archiveArtifacts artifacts: 'frontend-web/reports/**,frontend-web/dist/**',
                            allowEmptyArchive: true, fingerprint: true
                    }
                }
            }
        }
    }
}
