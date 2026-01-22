package com.devsync.util;

import cn.hutool.crypto.SecureUtil;
import cn.hutool.crypto.symmetric.AES;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

/**
 * 加密工具类
 *
 * @author xiaolei
 */
@Component
public class EncryptUtil {

    private final AES aes;

    public EncryptUtil(@Value("${devsync.encrypt.secret-key}") String secretKey) {
        // 使用密钥的MD5值作为AES密钥（16字节）
        byte[] key = SecureUtil.md5(secretKey).substring(0, 16).getBytes(StandardCharsets.UTF_8);
        this.aes = SecureUtil.aes(key);
    }

    /**
     * 加密
     *
     * @param plainText 明文
     * @return 密文（Base64编码）
     */
    public String encrypt(String plainText) {
        if (plainText == null || plainText.isEmpty()) {
            return plainText;
        }
        return aes.encryptBase64(plainText);
    }

    /**
     * 解密
     *
     * @param cipherText 密文（Base64编码）
     * @return 明文
     */
    public String decrypt(String cipherText) {
        if (cipherText == null || cipherText.isEmpty()) {
            return cipherText;
        }
        return aes.decryptStr(cipherText);
    }
}
