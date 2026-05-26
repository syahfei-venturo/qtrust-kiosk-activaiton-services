pipeline {
    agent any

    environment {
        REGISTRY = 'registry.qtrust.id'
        IMAGE_NAME = 'kiosk-socket-service'
        IMAGE_TAG = "build-${env.BUILD_NUMBER}"
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

        stage('Build Image') {
            steps {
                sh "docker build -t ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG} ."
            }
        }

        stage('Push Image') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'docker-registry-credentials',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh "echo \$DOCKER_PASS | docker login ${REGISTRY} -u \$DOCKER_USER --password-stdin"
                    sh "docker push ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
                    sh "docker tag ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG} ${REGISTRY}/${IMAGE_NAME}:latest"
                    sh "docker push ${REGISTRY}/${IMAGE_NAME}:latest"
                }
            }
        }

        stage('Deploy') {
            steps {
                sh "docker compose -f /opt/kiosk/docker-compose.yml up -d kiosk-socket"
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
            sh "docker logout ${REGISTRY} || true"
            cleanWs()
        }
    }
}
