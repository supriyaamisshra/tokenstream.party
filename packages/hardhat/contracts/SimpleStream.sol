//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/// @title Simple Stream Contract
/// @author ghostffcode, jaxcoder
/// @notice the meat and potatoes of the stream
contract SimpleStream is Ownable {
    using SafeMath for uint256;

    event Withdraw(
        address indexed to,
        uint256 amount,
        string reason
    );

    event Deposit(
        address indexed from,
        uint256 amount,
        string reason
    );

    address payable public toAddress; // = payable(0xD75b0609ed51307E13bae0F9394b5f63A7f8b6A1);
    uint256 public cap; // = 0.5 ether;
    uint256 public frequency; // 1296000 seconds == 2 weeks;
    uint256 public last; // stream starts empty (last = block.timestamp) or full (block.timestamp - frequency)
    IERC20 public token;

    constructor(
        address payable _toAddress,
        uint256 _cap,
        uint256 _frequency,
        bool _startsFull,
        IERC20 _token
    ) {
        toAddress = _toAddress;
        cap = _cap;
        frequency = _frequency;
        token = _token;
        if (_startsFull) {
            last = block.timestamp - frequency;
        } else {
            last = block.timestamp;
        }
    }

    /// @dev get the balance of a stream
    /// @return the balance of the stream
    function streamBalance() public view returns (uint256) {
        if (block.timestamp - last > frequency) {
            return cap;
        }
        return (cap * (block.timestamp - last)) / frequency;
    }

    /// @dev withdraw from a stream
    /// @param amount amount of withdraw
    /// @param reason reason for withdraw
    function streamWithdraw(uint256 amount, string memory reason, address beneficiary) external {
        require(_msgSender() == toAddress, "this stream is not for you ser");
        require(beneficiary != address(0), "cannot send to zero address");
        uint256 totalAmountCanWithdraw = streamBalance();
        require(totalAmountCanWithdraw >= amount, "not enough in the stream");
        uint256 cappedLast = block.timestamp - frequency;
        if (last < cappedLast) {
            last = cappedLast;
        }
        last =
            last +
            (((block.timestamp - last) * amount) / totalAmountCanWithdraw);
        emit Withdraw(beneficiary, amount, reason);
        require(token.transfer(beneficiary, amount), "Transfer failed");
    }

    /// @notice Explain to an end user what this does
    /// @dev Explain to a developer any extra details
    /// @param reason reason for deposit
    /// @param  value the amount of the deposit
    function streamDeposit(string memory reason, uint256 value) external {
        require(value >= cap / 10, "Not big enough, sorry.");
        require(
            token.transferFrom(_msgSender(), address(this), value),
            "Transfer of tokens is not approved or insufficient funds"
        );
        emit Deposit(_msgSender(), value, reason);
    }

    /// @dev Increase the cap of the stream
    /// @param _increase how much to increase the cap
    function increaseCap(uint256 _increase) public onlyOwner {
        require(_increase > 0, "Increase cap by more than 0");
        cap = cap.add(_increase);
    }

    /// @dev Update the frequency of a stream
    /// @param _frequency the new frequency
    function updateFrequency(uint256 _frequency) public onlyOwner {
        require(_frequency > 0, "Must be greater than 0");
        frequency = _frequency;
    }
}
