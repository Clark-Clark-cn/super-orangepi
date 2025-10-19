#include <wiringPi.h>
#include <iostream>
#include <thread>
#include <chrono>
#include <cstdint>
#include <cstdlib>
#include <sched.h>

static int waitLevelMicro(int pin, int level, int timeoutUs) {
    // 轮询等待达到相反电平，返回持续时间(微秒)，超时返回 -1
    int count = 0;
    while (digitalRead(pin) == level) {
        if (++count > timeoutUs) return -1;
        delayMicroseconds(1);
    }
    return count;
}

static int waitForLevel(int pin, int level, int timeoutUs) {
    unsigned int start = micros();
    while (digitalRead(pin) != level) {
        if ((int)(micros() - start) > timeoutUs) return -1;
    }
    return (int)(micros() - start);
}

// 测量高电平持续时间
static int measureHighFromCurrent(int pin, int timeoutUs) {
    unsigned int start = micros();
    if (waitForLevel(pin, LOW, timeoutUs) == -1) return -1;
    return (int)(micros() - start);
}

static bool readDHT11(int pin, int &humidity, int &temperature) {
    uint8_t data[5] = {0};

    pinMode(pin, OUTPUT);
    digitalWrite(pin, HIGH);
    delay(50);
    digitalWrite(pin, LOW);
    delay(20);
    digitalWrite(pin, HIGH);
    delayMicroseconds(30);
    pinMode(pin, INPUT);
    delayMicroseconds(5);

    if (waitForLevel(pin, LOW, 2000)  == -1||
        waitForLevel(pin, HIGH, 2000) == -1||
        waitForLevel(pin, LOW, 2000)  == -1) {
        std::cerr << "传感器无响应\n";
        return false;
    }

    for (int i = 0; i < 40; ++i) {
        if (waitForLevel(pin, HIGH, 1000) == -1) {
            std::cerr << "等待高电平超时\n";
            return false;
        }

        int highUs = measureHighFromCurrent(pin, 2000);
        if (highUs == -1){
            std::cerr << "等待高电平超时\n";
            return false;
        }

        data[i / 8] <<= 1;
        data[i / 8] |= (highUs > 45) ? 1 : 0;//TODO：configurable

        if (waitForLevel(pin, LOW, 1000) == -1) {
            std::cerr << "等待低电平超时\n";
            return false;
        }
    }

    uint8_t sum = (uint8_t)(data[0] + data[1] + data[2] + data[3]);
    if (sum != data[4]) {
        std::cerr << "校验失败: 计算 " << (int)sum << " != 接收 " << (int)data[4] << "\n";
        return false;
    }

    humidity    = data[0];
    temperature = data[2];
    return true;
}

int main(int argc, char** argv) {
    using namespace std::chrono;
    int DHT_PIN = 3;//TODO: configurable via args
    if (argc > 1) DHT_PIN = std::atoi(argv[1]);

    if (wiringPiSetup() == -1) {
        std::cerr << "wiringPi 初始化失败\n";
        return 1;
    }

    struct sched_param sp; sp.sched_priority = 10;
    sched_setscheduler(0, SCHED_FIFO, &sp);

    if (DHT_PIN < 0 || DHT_PIN > 64) {
        std::cerr << "无效的 wPi 引脚号: " << DHT_PIN << "\n";
        return 1;
    }

    while (true) {
        int h = 0, t = 0;
        bool ok = false;
        do{
            ok = readDHT11(DHT_PIN, h, t);
            std::cerr << (ok ? "读取成功\n" : "读取失败，重试...\n");
            if (!ok) delay(120);
        }while(!ok);

        if (ok) {
            std::cout << "湿度: " << h << "%, 温度: " << t << "°C" << std::endl;
        }
        std::this_thread::sleep_for(2s);
    }
    return 0;
}