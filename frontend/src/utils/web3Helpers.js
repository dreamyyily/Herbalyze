
import { ethers } from 'ethers';

export const connectWallet = async () => {
    if (window.ethereum) {
        try {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            await provider.send("eth_requestAccounts", []);
            const signer = provider.getSigner();
            const address = await signer.getAddress();
            return address;
        } catch (error) {
            console.error("Error connecting to wallet:", error);
            throw new Error("Failed to connect wallet.");
        }
    } else {
        throw new Error("MetaMask is not installed. Please install it to continue.");
    }
};

/**
 * Sign a message with MetaMask (FREE - no gas fee)
 * This is used for authentication without blockchain transactions
 */
export const signMessage = async (message) => {
    if (!window.ethereum) {
        throw new Error("MetaMask is not installed. Please install it to continue.");
    }

    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        
        // Sign the message (this is FREE, no gas fee)
        const signature = await signer.signMessage(message);
        
        return {
            address: address.toLowerCase(),
            signature: signature,
            message: message
        };
    } catch (error) {
        console.error("Error signing message:", error);
        if (error.code === 4001) {
            throw new Error("User rejected the signature request.");
        }
        throw new Error("Failed to sign message: " + error.message);
    }
};

/**
 * Generate authentication message for login
 */
export const generateAuthMessage = (address) => {
    const timestamp = Date.now();
    return `Herbalyze Authentication\n\nPlease sign this message to authenticate with your wallet.\n\nWallet: ${address}\nTimestamp: ${timestamp}`;
};

export const checkWalletConnection = async () => {
    if (window.ethereum) {
        try {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const accounts = await provider.listAccounts();
            return accounts.length > 0 ? accounts[0] : null;
        } catch (error) {
            console.error("Error checking wallet connection:", error);
            return null;
        }
    }
    return null;
};

export const listenToAccountChanges = (callback) => {
    if (window.ethereum) {
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length === 0) {
                // Disconnected
                callback(null);
            } else {
                // Account changed
                callback(accounts[0]);
            }
        });
    }
};
