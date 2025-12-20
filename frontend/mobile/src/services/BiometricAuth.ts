import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const rnBiometrics = new ReactNativeBiometrics();

class BiometricAuthService {
  async isAvailable(): Promise<boolean> {
    try {
      const { available, biometryType } = await rnBiometrics.isSensorAvailable();
      
      if (available) {
        console.log('Biometric type available:', biometryType);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Biometric availability check failed:', error);
      return false;
    }
  }

  async authenticate(): Promise<boolean> {
    try {
      const isAvailable = await this.isAvailable();
      
      if (!isAvailable) {
        console.log('Biometric authentication not available');
        return false;
      }

      const { success } = await rnBiometrics.simplePrompt({
        promptMessage: 'Authenticate to access QuantumTrade',
        cancelButtonText: 'Cancel',
      });

      if (success) {
        console.log('Biometric authentication successful');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return false;
    }
  }

  async createKeys(): Promise<boolean> {
    try {
      const { publicKey } = await rnBiometrics.createKeys();
      
      // Store public key
      await AsyncStorage.setItem('biometricPublicKey', publicKey);
      
      console.log('Biometric keys created');
      return true;
    } catch (error) {
      console.error('Failed to create biometric keys:', error);
      return false;
    }
  }

  async deleteKeys(): Promise<boolean> {
    try {
      const { keysDeleted } = await rnBiometrics.deleteKeys();
      
      if (keysDeleted) {
        await AsyncStorage.removeItem('biometricPublicKey');
        console.log('Biometric keys deleted');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to delete biometric keys:', error);
      return false;
    }
  }

  async createSignature(payload: string): Promise<string | null> {
    try {
      const { success, signature } = await rnBiometrics.createSignature({
        promptMessage: 'Sign transaction',
        payload,
      });

      if (success && signature) {
        return signature;
      }

      return null;
    } catch (error) {
      console.error('Failed to create signature:', error);
      return null;
    }
  }
}

export const BiometricAuth = new BiometricAuthService();
