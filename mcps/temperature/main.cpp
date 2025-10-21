#include <wiringPi.h>
#include <iostream>
#include <thread>
#include <chrono>
#include <cstdint>
#include <cstdlib>
#include <sched.h>
#include <fstream>
#include <string>
#include <ctime>

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

static bool readDHT11(int pin, int highUS, int &humidity, int &temperature) {
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
        data[i / 8] |= (highUs > highUS) ? 1 : 0;

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

    if(data[0]>100||data[2]>80){
        std::cerr << "数据异常: 湿度 " << (int)data[0] << "%, 温度 " << (int)data[2] << "°C\n";
        return false;
    }
    humidity    = data[0];
    temperature = data[2];
    return true;
}

int main(int argc, char** argv) {
    using namespace std::chrono;

    if (argc>1&&(argv[1]==std::string("--help")||argv[1]==std::string("-h"))){
        std::cout<<"用法: "<<argv[0]<<" [DHT_PIN] [OUTPUT_FILE] [HIGH_US]\n";
        std::cout<<"  DHT_PIN: 使用的wPi引脚号，默认3\n";
        std::cout<<"  OUTPUT_FILE: 输出数据文件路径，默认/tmp/temperature_humidity.json\n";
        std::cout<<"  HIGH_US: 高电平阈值，单位微秒，默认45\n";
        return 0;
    }

    int DHT_PIN = 3;
    if (argc > 1) DHT_PIN = std::atoi(argv[1]);

    std::string output_file = "/tmp/temperature_humidity.json";
    if (argc > 2) output_file = argv[2];
    
    int highUS = 45; // 高电平阈值，单位微秒
    if (argc > 3) highUS = std::atoi(argv[3]);

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

    std::cout << "温度湿度监控服务启动，数据文件: " << output_file << std::endl;

    while (true) {
        int h = 0, t = 0;
        bool ok = false;
        do{
            ok = readDHT11(DHT_PIN, highUS, h, t);
            std::cerr << (ok ? "读取成功\n" : "读取失败，重试...\n");
            if (!ok) delay(120);
        }while(!ok);

        if (ok) {
            // 获取当前时间戳
            auto now = std::chrono::system_clock::now();
            auto timestamp = std::chrono::duration_cast<std::chrono::seconds>(
                now.time_since_epoch()).count();

            // 创建JSON格式数据
            std::string json_data = "{";
            json_data += "\"timestamp\":" + std::to_string(timestamp) + ",";
            json_data += "\"humidity\":" + std::to_string(h) + ",";
            json_data += "\"temperature\":" + std::to_string(t) + ",";
            json_data += "\"unit\":{\"humidity\":\"%\",\"temperature\":\"°C\"}";
            json_data += "}";

            // 写入文件
            std::ofstream file(output_file, std::ios::out | std::ios::trunc);
            if (file.is_open()) {
                file << json_data;
                file.close();
                std::cout << "数据已更新: 湿度 " << h << "%, 温度 " << t << "°C" << std::endl;
            } else {
                std::cerr << "无法写入数据文件: " << output_file << std::endl;
            }
        }
        std::this_thread::sleep_for(30s);  // 每30秒更新一次
    }
    return 0;
}