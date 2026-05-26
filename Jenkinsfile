pipeline {
    agent any

    environment {
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
                sh "docker build --no-cache -t ${IMAGE_NAME}:${IMAGE_TAG} -t ${IMAGE_NAME}:latest ."
            }
        }

        stage('Create DB') {
            steps {
                sh """
                    docker exec -i my-postgres psql -U myuser -d mydatabase -c \
                        "SELECT 1 FROM pg_database WHERE datname = 'kiosk_socket'" | grep -q 1 || \
                    docker exec -i my-postgres psql -U myuser -d mydatabase -c \
                        "CREATE DATABASE kiosk_socket"
                """
            }
        }

        stage('Deploy') {
            steps {
                sh "docker compose up -d kiosk-socket"
                sh "sleep 5 && docker exec kiosk-socket-service npx prisma db seed"
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
