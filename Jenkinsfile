pipeline {
    agent any

    environment {
        REGISTRY = 'registry.qtrust.id'
        IMAGE_NAME = 'kiosk-socket-service'
        IMAGE_TAG = "${env.BRANCH_NAME}-${env.BUILD_NUMBER}"
    }

    options {
        timeout(time: 15, unit: 'MINUTES')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Test') {
            agent {
                docker {
                    image 'node:20-alpine'
                    args '-v $HOME/.npm:/root/.npm'
                }
            }
            steps {
                sh 'npm ci'
                sh 'npx prisma generate'
                sh 'npm run lint'
                sh 'npm run test'
            }
        }

        stage('Build Image') {
            steps {
                script {
                    dockerImage = docker.build("${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}")
                }
            }
        }

        stage('Push Image') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                    branch 'staging'
                    branch 'production'
                }
            }
            steps {
                script {
                    docker.withRegistry("https://${REGISTRY}", 'docker-registry-credentials') {
                        dockerImage.push()
                        dockerImage.push("${env.BRANCH_NAME}-latest")
                    }
                }
            }
        }

        stage('Deploy Staging') {
            when {
                branch 'staging'
            }
            steps {
                sshagent(credentials: ['deploy-ssh-key']) {
                    sh """
                        ssh -o StrictHostKeyChecking=no deploy@staging.qtrust.id \\
                            'docker pull ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG} && \\
                             docker compose -f /opt/kiosk/docker-compose.yml up -d kiosk-socket'
                    """
                }
            }
        }

        stage('Deploy Production') {
            when {
                branch 'production'
            }
            steps {
                input message: 'Deploy to production?', ok: 'Deploy'
                sshagent(credentials: ['deploy-ssh-key']) {
                    sh """
                        ssh -o StrictHostKeyChecking=no deploy@prod.qtrust.id \\
                            'docker pull ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG} && \\
                             docker compose -f /opt/kiosk/docker-compose.yml up -d kiosk-socket'
                    """
                }
            }
        }
    }

    post {
        failure {
            echo "Build failed: ${env.BUILD_URL}"
        }
        success {
            echo "Build succeeded: ${IMAGE_NAME}:${IMAGE_TAG}"
        }
        cleanup {
            cleanWs()
        }
    }
}
