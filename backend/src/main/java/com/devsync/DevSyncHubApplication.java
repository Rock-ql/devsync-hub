package com.devsync;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * DevSync Hub 应用启动类
 *
 * @author xiaolei
 */
@SpringBootApplication
@MapperScan("com.devsync.mapper")
@EnableAsync
public class DevSyncHubApplication {

    public static void main(String[] args) {
        SpringApplication.run(DevSyncHubApplication.class, args);
    }
}
